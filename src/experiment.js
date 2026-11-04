// 전체 흐름: 동의 → 인적사항 → 전체화면 → 화면 점검 → [단일: 안내·연습·본 150] → [이중: 안내·연습·본 450] → 사후 문항 → 저장
(function boot() {
  const C = DDM_CONFIG;

  // 이탈 이벤트 로그 (창 포커스, 탭 전환, 전체화면 해제, 창 크기 변경)
  window.DDM_EVENTS = [];
  const logEv = (type, extra) => window.DDM_EVENTS.push(Object.assign({ t: Math.round(performance.now()), type }, extra || {}));
  window.addEventListener("blur", () => logEv("blur"));
  window.addEventListener("focus", () => logEv("focus"));
  document.addEventListener("visibilitychange", () => logEv("visibility", { state: document.visibilityState }));
  document.addEventListener("fullscreenchange", () => logEv("fullscreen", { on: !!document.fullscreenElement }));
  window.addEventListener("resize", () => logEv("resize", { w: window.innerWidth, h: window.innerHeight }));
  if (C.debug) window.__ddm = { phase: "idle" };

  // ---- 실험자용 긴급 중지: Esc = 일시 중지, Enter = 재개 (안내문에는 노출하지 않음)
  window.DDM_PAUSED = false;
  window.DDM_FS_ARMED = false;                      // 전체화면 진입 후에만 true (전체화면 해제도 중지로 처리)
  const pauseEl = document.createElement("div");
  pauseEl.id = "ddm-pause";
  pauseEl.textContent = "잠시 기다려 주세요";
  document.documentElement.appendChild(pauseEl);   // body가 아닌 html 아래: jsPsych의 화면 갱신에 지워지지 않게
  const pauseNow = (reason) => {
    if (window.DDM_PAUSED) return;
    window.DDM_PAUSED = true; pauseEl.style.display = "flex";
    logEv("pause", { reason });
    window.dispatchEvent(new Event("ddm:pause"));
  };
  const resumeNow = () => {
    if (!window.DDM_PAUSED) return;
    window.DDM_PAUSED = false; pauseEl.style.display = "none";
    logEv("resume");
    if (window.DDM_FS_ARMED && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});     // Enter 키 입력이 사용자 동작으로 인정됨
    }
    window.dispatchEvent(new Event("ddm:resume"));
  };
  window.addEventListener("keydown", (e) => {       // 캡처 단계: jsPsych·시행 코드보다 먼저 받는다
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); pauseNow("esc"); return; }
    if (window.DDM_PAUSED) {                         // 중지 중에는 Enter 외 모든 키 입력을 차단
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === "Enter" && !e.repeat) resumeNow();
    }
  }, true);
  document.addEventListener("fullscreenchange", () => {   // 전체화면에서 Esc는 브라우저가 먼저 처리하므로 해제 자체를 중지로 취급
    if (window.DDM_FS_ARMED && !document.fullscreenElement) pauseNow("fullscreen_exit");
  });

  const isMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
                   (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  if (isMobile) {
    document.body.innerHTML = '<div id="gate"><p>이 과제는 키보드가 있는 컴퓨터(노트북·데스크톱)에서만 참여할 수 있습니다.</p></div>';
    return;
  }

  const PID_RE = /^[A-Za-z0-9_-]{1,20}$/;
  if (PID_RE.test(C.pid)) return start(C.pid);

  // URL에 참가자 번호가 없으면 먼저 입력받는다 (저장 파일명에 쓰이므로 jsPsych 시작 전에 확정)
  const gate = document.createElement("div");
  gate.id = "gate";
  gate.innerHTML = `<p>연구자에게 안내받은 <b>참가자 번호</b>를 입력해 주세요.</p>
    <form><input id="gate-pid" maxlength="20" autocomplete="off" autofocus><button type="submit">시작</button></form>
    <p id="gate-err" class="muted"></p>`;
  document.body.appendChild(gate);
  gate.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = gate.querySelector("#gate-pid").value.trim();
    if (!PID_RE.test(v)) { gate.querySelector("#gate-err").textContent = "영문·숫자·-·_ 만 사용할 수 있습니다 (최대 20자)."; return; }
    gate.remove();
    start(v);
  });

  function start(pid) {
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    const runId = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
    const filename = `${pid}_${runId}.csv`;                 // DataPipe: 실험 안에서 파일명이 유일해야 함

    // R2 키 배정: 전원 고정 (기본 km=0: F = 확인, J = 번복). URL의 km=1로만 바꿀 수 있다.
    const km = C.km, kmSource = C.kmSource;
    const confirmKey = km === 0 ? "F" : "J", overturnKey = km === 0 ? "J" : "F";

    let running = true;
    window.addEventListener("beforeunload", (e) => { if (running) { e.preventDefault(); e.returnValue = ""; } });

    const jsPsych = initJsPsych({
      extensions: [{
        type: jsPsychExtensionPipe,
        params: {
          experiment_id: DATAPIPE_EXPERIMENT_ID,
          filename: () => filename,
          enabled: !C.nosave,
          data_string: () => jsPsych.data.get().ignore(["stimulus"]).csv(),   // 동의서·안내문 HTML 열 제외
          wait_message: "<p>데이터를 저장하고 있습니다. 창을 닫지 마세요.</p>",
          done_message: "<p>모든 과정이 끝났습니다. 참여해 주셔서 감사합니다.<br>이제 창을 닫으셔도 됩니다.</p>",
          on_save: (res) => {
            running = false;
            if (!res.ok) {
              const el = jsPsych.getDisplayElement();
              el.innerHTML = `<p>데이터 저장에 실패했습니다. 연구자에게 알려 주세요.</p>
                <p><button id="dl" class="jspsych-btn">데이터 파일 내려받기</button></p>`;
              el.querySelector("#dl").onclick = () => jsPsych.data.get().ignore(["stimulus"]).localSave("csv", filename);
            }
          },
        },
      }],
      on_finish: () => { running = false; },
      // 시행(ddm-trial) 화면만 중간 회색 배경, 그 외 화면은 밝은 회색 (시행 사이에는 배경이 바뀌지 않음)
      on_trial_start: (trial) => {
        const isTrial = !!(trial.type && trial.type.info && trial.type.info.name === "ddm-trial");
        document.documentElement.classList.toggle("ddm-gray", isTrial);
      },
    });
    if (C.nosave) running = true;
    if (C.debug) window.__ddm.jsPsych = jsPsych;

    jsPsych.data.addProperties({
      pid, run_id: runId, code_version: CODE_VERSION, km, km_source: kmSource,
      deltas: C.deltas.join("/"), n_single_per_level: C.nSingle, n_double_per_level: C.nDouble,
      test_mode: C.nosave || C.debug || C.nofs,
    });

    // ---------- 도우미
    const space = (html, extra) => Object.assign({
      type: jsPsychHtmlKeyboardResponse, stimulus: html, choices: [" "],
      prompt: '<p class="muted center">스페이스바를 누르면 다음으로 넘어갑니다</p>',
    }, extra || {});
    const shuffle = (a) => jsPsych.randomization.shuffle(a);
    let timing = { fpp: 1, nominal: 16.67 };   // 화면 점검 뒤에 확정

    const specList = (perLevel) => {
      const list = [];
      C.deltas.forEach((d, i) => {
        const first = i % 2 === 0 ? "bright" : "dark", second = first === "bright" ? "dark" : "bright";   // 홀수일 때 남는 1개를 난이도마다 번갈아 배정
        for (let k = 0; k < perLevel; k++) list.push({ level: i + 1, delta: d, truth: k % 2 === 0 ? first : second });
      });
      return shuffle(list);
    };
    const trialsFor = (mode, list, tag, breakEvery) => {
      const out = [];
      list.forEach((s, i) => {
        out.push({
          type: DdmTrialPlugin,
          mode, truth: s.truth, km,
          p_white: 0.5 + (s.truth === "bright" ? s.delta : -s.delta),
          frames_per_patch: () => timing.fpp, nominal_ms: () => timing.nominal,
          cycle_n: C.cycleN, fix_ms: C.fixMs, fb_ms: C.fbMs, r1_max_ms: C.r1MaxMs, r2_max_ms: C.r2MaxMs,
          data: { task_phase: tag, mode, trial_n: i + 1, level: s.level, delta: s.delta, truth: s.truth, p_white: 0.5 + (s.truth === "bright" ? s.delta : -s.delta) },
        });
        if (breakEvery && (i + 1) % breakEvery === 0 && i + 1 < list.length) {
          // 자유 휴식: 원하는 만큼 쉬고 버튼을 눌러 재개 (rt = 휴식 시간 ms가 데이터에 남음)
          out.push({
            type: jsPsychHtmlButtonResponse, choices: ["계속하기"], data: { task_phase: "break", break_after: i + 1 },
            stimulus: `<div class="center"><p>잠시 쉬어 가세요.</p><p>진행: ${i + 1} / ${list.length}</p>
              <p class="muted">원하는 만큼 쉬셔도 됩니다. 눈이 피로하면 잠깐 눈을 감았다 뜨세요.<br>준비되면 아래 버튼을 눌러 주세요.</p></div>`,
          });
        }
      });
      return out;
    };

    const limitTxt = `한 번의 판단에 너무 오래(약 ${Math.round(C.r1MaxMs / 1000)}초 이상) 걸리면 다음 시행으로 넘어갑니다.`;

    // ---------- 타임라인
    const tl = [];

    tl.push({
      type: jsPsychHtmlButtonResponse, stimulus: CONSENT_HTML, choices: ["동의합니다", "동의하지 않습니다"],
      data: { task_phase: "consent" },
      on_finish: (d) => { d.consent = d.response === 0; if (d.response !== 0) jsPsych.abortExperiment("참여에 동의하지 않으셨습니다. 이 창을 닫으셔도 됩니다."); },
    });

    tl.push({
      type: jsPsychSurveyHtmlForm,
      preamble: "<h3>기본 정보</h3>",
      html: `<p>참가자 번호: <b>${pid}</b></p>
        <div class="form-row"><label>만 나이</label><input name="age" type="number" min="18" max="99" step="1" required> 세</div>
        <div class="form-row"><label>성별</label><select name="gender" required>
          <option value="">선택</option><option value="male">남성</option><option value="female">여성</option>
          <option value="other">기타</option><option value="na">응답하지 않음</option></select></div>`,
      button_label: "다음", data: { task_phase: "demographics" },
      on_finish: (d) => { d.age = Number(d.response.age); d.gender = d.response.gender; },
    });

    tl.push(space(`<h3>시작하기 전에</h3>
      <p>아래를 모두 확인해 주세요.</p>
      <ul style="text-align:left">
        <li>모니터 밝기를 중간 이상으로 하고, 야간모드·자동 밝기 조절은 꺼 주세요.</li>
        <li>브라우저 확대/축소를 100%로 맞춰 주세요 (<b>Ctrl + 0</b>).</li>
        <li>다른 프로그램·창을 닫고, 알림(메신저, 메일)을 꺼 주세요. 휴대전화는 보이지 않는 곳에 두세요.</li>
        <li>조용하고 밝기가 일정한 곳에서, 화면에서 팔 길이 정도 떨어져 앉아 주세요.</li>
        <li>Zoom 화면 공유가 켜져 있어야 합니다. 연구자가 진행 상황을 확인합니다.</li>
      </ul>`, { data: { task_phase: "setup" } }));

    if (!C.nofs) tl.push({
      type: jsPsychFullscreen, fullscreen_mode: true, data: { task_phase: "fullscreen" },
      on_finish: () => { window.DDM_FS_ARMED = true; },
      message: "<p>과제는 전체화면으로 진행됩니다.<br>아래 버튼을 누르면 전체화면으로 전환됩니다. 과제 중에는 전체화면을 끄지 마세요.</p>",
      button_label: "전체화면으로 시작",
    });

    // 화면 점검: 프레임 간격(주사율) 측정
    tl.push({
      type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: 2500,
      stimulus: '<p class="center">화면을 점검하고 있습니다. 잠시만 기다려 주세요…</p>',
      data: { task_phase: "display_check" },
      on_load: () => {
        window.__samples = [];
        const f = (ts) => { window.__samples.push(ts); if (window.__samples.length < 400 && window.__sampling) requestAnimationFrame(f); };
        window.__sampling = true; requestAnimationFrame(f);
      },
      on_finish: (d) => {
        window.__sampling = false;
        const s = window.__samples || [], iv = [];
        for (let i = 5; i < s.length; i++) iv.push(s[i] - s[i - 1]);         // 처음 몇 프레임 제외
        iv.sort((a, b) => a - b);
        const med = iv.length ? iv[iv.length >> 1] : 16.67;
        const hz = 1000 / med;
        timing = { fpp: Math.max(1, Math.round(hz / 67)), nominal: med };    // Evans et al. 67 Hz에 가장 가까운 정수 프레임 수
        Object.assign(d, {
          refresh_hz: Math.round(hz * 10) / 10, frame_ms_median: Math.round(med * 100) / 100,
          frames_per_patch: timing.fpp, patch_hz: Math.round((hz / timing.fpp) * 10) / 10,
          screen_w: screen.width, screen_h: screen.height, inner_w: window.innerWidth, inner_h: window.innerHeight,
          dpr: window.devicePixelRatio, fullscreen: !!document.fullscreenElement, user_agent: navigator.userAgent,
        });
        jsPsych.data.addProperties({ refresh_hz: d.refresh_hz, frames_per_patch: timing.fpp });
        if (window.innerWidth < C.minW || window.innerHeight < C.minH) {
          jsPsych.abortExperiment("화면(창)이 너무 작습니다. 더 큰 화면에서 전체화면으로 다시 접속해 주세요.");
        } else if (hz < 45) {
          jsPsych.abortExperiment("화면 갱신 속도가 너무 낮습니다(" + Math.round(hz) + " Hz). 연구자에게 알려 주세요.");
        }
      },
    });

    // ===== 사전 척도 (src/scale.js의 items가 있을 때만) =====
    if (SCALE.items.length) {
      const pts = SCALE.points;
      const legend = SCALE.labels && SCALE.labels.length === pts
        ? SCALE.labels.map((t, k) => `<span>${k + 1} = ${t}</span>`).join("")
        : `1 = ${SCALE.low} &nbsp;…&nbsp; ${pts} = ${SCALE.high}`;
      const itemsHtml = SCALE.items.map((it, i) => `
        <div class="likert-item">
          <p class="likert-q"><b>${i + 1}.</b> ${it.text}</p>
          <div class="likert-opts">${Array.from({ length: pts }, (_, k) =>
            `<label><input type="radio" name="scale_${i + 1}" value="${k + 1}" ${k === 0 ? "required" : ""}><span>${k + 1}</span></label>`).join("")}</div>
        </div>`).join("");
      tl.push({
        type: jsPsychSurveyHtmlForm,
        preamble: `<h3>${SCALE.title}</h3><p>${SCALE.instruction}</p>`,
        html: `<div class="likert-legend">${legend}</div>${itemsHtml}`,
        button_label: "제출", data: { task_phase: "scale" },
        on_finish: (d) => {
          let total = 0;
          SCALE.items.forEach((it, i) => {
            const raw = Number(d.response["scale_" + (i + 1)]);
            d["scale_" + (i + 1)] = raw;                              // 원점수 (역채점 전)
            total += it.reverse ? pts + 1 - raw : raw;
          });
          d.scale_total = total; d.scale_n_items = SCALE.items.length;
        },
      });
    }

    // ===== 단일반응 =====
    tl.push(space(`<h3>과제 안내 (1/3)</h3>
      <p>검은색과 흰색 점으로 이루어진 정사각형이 화면에 나타납니다. 점들의 배열은 계속 바뀝니다.</p>
      <p>이 정사각형에서 <b>흰 점이 검은 점보다 더 많은지</b>, 아니면 <b>더 적은지</b> 판단해 주세요.</p>`, { data: { task_phase: "instr_single" } }));
    tl.push(space(`<h3>과제 안내 (2/3)</h3>
      <p>흰 점이 더 많다고 판단되면 <b>"밝다"</b> → <span class="kbd">J</span> 키<br>
         검은 점이 더 많다고 판단되면 <b>"어둡다"</b> → <span class="kbd">F</span> 키</p>
      <p>왼손 검지는 <span class="kbd">F</span>, 오른손 검지는 <span class="kbd">J</span> 위에 올려 두세요.</p>`, { data: { task_phase: "instr_single" } }));
    tl.push(space(`<h3>과제 안내 (3/3)</h3>
      <p>빨리 누르는 것보다 <b>정확하게</b> 판단하는 것이 중요합니다. 시간 제한은 두지 않습니다.</p>
      <p>${limitTxt}</p>
      <p>응답 후에 <b>정답/오답</b>이 표시됩니다. 거의 구분이 안 되는 시행도 있으니, 확신이 없어도 최선의 판단을 해 주세요.</p>
      <p>먼저 연습 시행을 해 보겠습니다.</p>`, { data: { task_phase: "instr_single" } }));
    tl.push(...trialsFor("single", specList(Math.ceil(C.nPracSingle / 3)).slice(0, C.nPracSingle), "practice_single", 0));
    tl.push(space(`<div class="center"><h3>연습이 끝났습니다</h3><p>이제 본 과제를 시작합니다. 연습과 같은 방식입니다.</p></div>`, { data: { task_phase: "instr_single" } }));
    tl.push(...trialsFor("single", specList(C.nSingle), "main_single", C.breakSingle));

    // ===== 이중반응 =====
    tl.push(space(`<div class="center"><h3>잘 하셨습니다</h3><p>다음 과제는 방식이 조금 다릅니다. 안내를 잘 읽어 주세요.</p></div>`, { data: { task_phase: "instr_double" } }));
    tl.push(space(`<h3>새 과제 안내 (1/3)</h3>
      <p>이번에는 <b>한 시행에서 두 번</b> 응답합니다.</p>
      <p><b>첫 번째 응답:</b> 이전과 같이 <span class="kbd">F</span>(어둡다) 또는 <span class="kbd">J</span>(밝다)를 누릅니다.</p>
      <p>첫 응답 후에도 <b>정사각형은 계속 바뀝니다.</b></p>`, { data: { task_phase: "instr_double" } }));
    tl.push(space(`<h3>새 과제 안내 (2/3)</h3>
      <p><b>두 번째 응답:</b> 첫 번째 응답이 맞다고 생각하면 <b>"확인"</b>, 바꾸고 싶으면 <b>"번복"</b>을 누릅니다.</p>
      <p style="font-size:26px" class="center">확인 → <span class="kbd">${confirmKey}</span> &nbsp;&nbsp;&nbsp; 번복 → <span class="kbd">${overturnKey}</span></p>
      <p>두 번째 응답 때는 화면 아래에 이 키가 표시됩니다. 번복하면 첫 응답과 반대 답이 최종 응답이 됩니다.</p>`, { data: { task_phase: "instr_double" } }));
    tl.push(space(`<h3>새 과제 안내 (3/3)</h3>
      <p><b>최종 응답(두 번째 응답)</b>의 정확도만 중요합니다. 첫 번째 응답의 정오는 점수에 반영되지 않습니다. 다만 첫 응답은 반드시 해 주세요.</p>
      <p>시간 제한은 두지 않으며 정확하게 판단해 주세요. ${limitTxt}</p>
      <p>응답 후에 최종 응답의 <b>정답/오답</b>이 표시됩니다.</p>
      <p>먼저 연습 시행을 해 보겠습니다.</p>`, { data: { task_phase: "instr_double" } }));
    tl.push(...trialsFor("double", specList(Math.ceil(C.nPracDouble / 3)).slice(0, C.nPracDouble), "practice_double", 0));
    tl.push(space(`<div class="center"><h3>연습이 끝났습니다</h3><p>이제 본 과제를 시작합니다. 연습과 같은 방식입니다.<br>중간에 쉬는 시간이 있습니다.</p></div>`, { data: { task_phase: "instr_double" } }));
    tl.push(...trialsFor("double", specList(C.nDouble), "main_double", C.breakDouble));

    // ===== 사후 문항 (사용 기기 1문항만) =====
    tl.push({
      type: jsPsychSurveyHtmlForm,
      preamble: "<h3>마지막 질문입니다</h3>",
      html: `<div class="form-row"><label>사용한 기기</label><select name="device" required>
          <option value="">선택</option><option value="laptop">노트북</option><option value="desktop">데스크톱</option><option value="other">기타</option></select></div>`,
      button_label: "제출", data: { task_phase: "post_survey" },
      on_finish: (d) => {
        d.device = d.response.device;
        d.event_log = JSON.stringify(window.DDM_EVENTS);          // 창 이탈·전체화면·크기 변경 기록
      },
    });
    tl.push({
      type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: 1200, data: { task_phase: "end" },
      on_start: () => { window.DDM_FS_ARMED = false; },
      stimulus: '<p class="center">과제가 모두 끝났습니다.</p>',
    });

    jsPsych.run(tl);
  }
})();
