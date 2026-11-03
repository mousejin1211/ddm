// 동적 밝기 변별 시행 (단일반응 / 이중반응) — jsPsych 8 커스텀 플러그인
//
// 자극: 64×64 흑백 픽셀 패치. 흰 픽셀 비율 = p_white (패치마다 정확히 round(p_white*4096)개).
//       시행마다 cycle_n장(기본 4장)을 만들어 frames_per_patch 프레임마다 다음 패치로 순환.
//       R1 이후에도 자극은 R2를 누르거나 시간 상한이 될 때까지 계속 바뀜 (정지·마스킹 없음).
// 시간: requestAnimationFrame 기준. onset = 첫 패치가 그려지는 프레임의 rAF 타임스탬프.
//       RT = keydown 이벤트의 timeStamp − onset (둘 다 performance.now 기준).
// 키:   R1  f = 어둡다 / j = 밝다
//       R2  km=0: f = 확인, j = 번복 / km=1: f = 번복, j = 확인   (이중반응만)
class DdmTrialPlugin {
  static info = {
    name: "ddm-trial",
    version: "0.1.0",
    parameters: {
      mode: { type: jsPsychModule.ParameterType.STRING, default: "double" },       // "single" | "double"
      p_white: { type: jsPsychModule.ParameterType.FLOAT, default: 0.5 },
      truth: { type: jsPsychModule.ParameterType.STRING, default: "bright" },      // "bright" | "dark"
      km: { type: jsPsychModule.ParameterType.INT, default: 0 },
      frames_per_patch: { type: jsPsychModule.ParameterType.INT, default: 1 },
      nominal_ms: { type: jsPsychModule.ParameterType.FLOAT, default: 16.67 },     // 측정한 프레임 간격
      cycle_n: { type: jsPsychModule.ParameterType.INT, default: 4 },
      fix_ms: { type: jsPsychModule.ParameterType.INT, default: 500 },
      fb_ms: { type: jsPsychModule.ParameterType.INT, default: 500 },
      r1_max_ms: { type: jsPsychModule.ParameterType.INT, default: 12000 },
      r2_max_ms: { type: jsPsychModule.ParameterType.INT, default: 8000 },
    },
    data: {
      r1_key: { type: jsPsychModule.ParameterType.STRING },
      r1_choice: { type: jsPsychModule.ParameterType.STRING },
      rt1: { type: jsPsychModule.ParameterType.FLOAT },
      r1_correct: { type: jsPsychModule.ParameterType.BOOL },
      r2_key: { type: jsPsychModule.ParameterType.STRING },
      r2_action: { type: jsPsychModule.ParameterType.STRING },
      r2_choice: { type: jsPsychModule.ParameterType.STRING },
      rt2_abs: { type: jsPsychModule.ParameterType.FLOAT },
      t2: { type: jsPsychModule.ParameterType.FLOAT },
      final_correct: { type: jsPsychModule.ParameterType.BOOL },
      same_key: { type: jsPsychModule.ParameterType.BOOL },
      status: { type: jsPsychModule.ParameterType.STRING },
      n_frames: { type: jsPsychModule.ParameterType.INT },
      frame_mean: { type: jsPsychModule.ParameterType.FLOAT },
      frame_sd: { type: jsPsychModule.ParameterType.FLOAT },
      frame_max: { type: jsPsychModule.ParameterType.FLOAT },
      n_long_frames: { type: jsPsychModule.ParameterType.INT },
      n_events: { type: jsPsychModule.ParameterType.INT },
      onset_abs: { type: jsPsychModule.ParameterType.FLOAT },
    },
  };

  constructor(jsPsych) { this.jsPsych = jsPsych; }

  trial(display_element, trial) {
    return new Promise((resolve) => {
      const SIZE = 64, N = SIZE * SIZE;
      const double = trial.mode === "double";
      const confirmKey = trial.km === 0 ? "f" : "j";
      const overturnKey = confirmKey === "f" ? "j" : "f";
      const choiceOf = (k) => (k === "j" ? "bright" : "dark");
      const round1 = (x) => Math.round(x * 10) / 10;
      const evStart = (window.DDM_EVENTS || []).length;
      const dbg = window.__ddm;                       // debug=1일 때만 존재 (테스트 봇용)

      display_element.innerHTML = `
        <div id="ddm-wrap">
          <div id="ddm-stage">
            <canvas id="ddm-canvas" width="${SIZE}" height="${SIZE}"></canvas>
            <div id="ddm-fix">+</div>
            <div id="ddm-fb"></div>
          </div>
          <div id="ddm-keys"></div>
        </div>`;
      const canvas = display_element.querySelector("#ddm-canvas");
      const ctx = canvas.getContext("2d", { alpha: false });
      const fixEl = display_element.querySelector("#ddm-fix");
      const fbEl = display_element.querySelector("#ddm-fb");
      const keysEl = display_element.querySelector("#ddm-keys");

      // ---- 패치 생성 (정확한 흰 픽셀 수)
      const nWhite = Math.round(trial.p_white * N);
      const makePatch = () => {
        const idx = new Uint16Array(N);
        for (let i = 0; i < N; i++) idx[i] = i;
        for (let i = N - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
        const img = ctx.createImageData(SIZE, SIZE);
        for (let p = 0; p < N; p++) img.data[4 * p + 3] = 255;           // 검정, 불투명
        for (let k = 0; k < nWhite; k++) { const o = 4 * idx[k]; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; }
        return img;
      };
      const patches = Array.from({ length: trial.cycle_n }, makePatch);

      // ---- 상태
      let phase = "fix";                // fix → wait_onset → r1 → (r2) → fb → done
      let onset = null, raf = 0, frameCount = 0, lastIdx = -1;
      const frameTimes = [];
      let r1 = null, r2 = null;
      let tFix = 0, tR1 = 0, tR2 = 0;
      const setPhase = (p) => { phase = p; if (dbg) { dbg.phase = p; dbg.truth = trial.truth; dbg.km = trial.km; dbg.mode = trial.mode; dbg.delta = Math.abs(trial.p_white - 0.5); } };
      const keyLabel = (stage) => stage === 1
        ? `<span class="kbd">F</span> 어둡다 &nbsp;&nbsp; <span class="kbd">J</span> 밝다`
        : `<span class="kbd">${confirmKey.toUpperCase()}</span> 확인 &nbsp;&nbsp; <span class="kbd">${overturnKey.toUpperCase()}</span> 번복`;

      setPhase("fix");
      tFix = setTimeout(startStimulus, trial.fix_ms);

      function startStimulus() {
        setPhase("wait_onset");
        document.addEventListener("keydown", onKey, true);
        raf = requestAnimationFrame(frame);
      }

      function frame(ts) {
        if (phase === "done" || phase === "fb") return;
        if (onset === null) {                         // 첫 프레임: 패치를 그리고 보이게 함
          onset = ts;
          fixEl.style.display = "none";
          canvas.style.visibility = "visible";
          keysEl.innerHTML = keyLabel(1);
          setPhase("r1");
          tR1 = setTimeout(() => finish("r1_timeout"), trial.r1_max_ms);
        }
        frameTimes.push(ts);
        const idx = Math.floor(frameCount / trial.frames_per_patch) % patches.length;
        if (idx !== lastIdx) { ctx.putImageData(patches[idx], 0, 0); lastIdx = idx; }
        frameCount++;
        raf = requestAnimationFrame(frame);
      }

      function onKey(e) {
        if (e.repeat) return;
        const k = (e.key || "").toLowerCase();
        if (k !== "f" && k !== "j") return;
        if (onset === null || e.timeStamp < onset) return;
        if (phase === "r1") {
          r1 = { key: k, t: e.timeStamp };
          clearTimeout(tR1);
          if (!double) return finish("ok");
          setPhase("r2");
          keysEl.innerHTML = keyLabel(2);
          tR2 = setTimeout(() => finish("r2_timeout"), trial.r2_max_ms);
        } else if (phase === "r2") {
          r2 = { key: k, t: e.timeStamp };
          clearTimeout(tR2);
          finish("ok");
        }
      }

      function frameStats() {
        const d = [];
        for (let i = 1; i < frameTimes.length; i++) d.push(frameTimes[i] - frameTimes[i - 1]);
        if (!d.length) return { n: frameTimes.length, mean: null, sd: null, max: null, long: 0 };
        const mean = d.reduce((a, b) => a + b, 0) / d.length;
        const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
        return { n: frameTimes.length, mean: round1(mean), sd: round1(sd), max: round1(Math.max(...d)),
                 long: d.filter((x) => x > 1.5 * trial.nominal_ms).length };
      }

      function finish(status) {
        if (phase === "fb" || phase === "done") return;
        setPhase("fb");
        cancelAnimationFrame(raf);
        clearTimeout(tFix); clearTimeout(tR1); clearTimeout(tR2);
        document.removeEventListener("keydown", onKey, true);

        const fs = frameStats();
        const out = {
          status,
          r1_key: r1 ? r1.key : null,
          r1_choice: r1 ? choiceOf(r1.key) : null,
          rt1: r1 ? round1(r1.t - onset) : null,
          r1_correct: r1 ? choiceOf(r1.key) === trial.truth : null,
          r2_key: null, r2_action: null, r2_choice: null, rt2_abs: null, t2: null,
          final_correct: null, same_key: null,
          n_frames: fs.n, frame_mean: fs.mean, frame_sd: fs.sd, frame_max: fs.max, n_long_frames: fs.long,
          n_events: (window.DDM_EVENTS || []).length - evStart,
          onset_abs: onset === null ? null : round1(onset),
        };
        if (!double) {
          out.final_correct = out.r1_correct;
        } else if (r2) {
          const action = r2.key === confirmKey ? "confirm" : "overturn";
          out.r2_key = r2.key;
          out.r2_action = action;
          out.r2_choice = action === "confirm" ? out.r1_choice : (out.r1_choice === "bright" ? "dark" : "bright");
          out.rt2_abs = round1(r2.t - onset);
          out.t2 = round1(r2.t - r1.t);
          out.final_correct = out.r2_choice === trial.truth;
          out.same_key = r2.key === r1.key;
        }

        // ---- 피드백 (이중반응은 최종 응답(R2) 정오답)
        canvas.style.visibility = "hidden";
        fixEl.style.display = "none";
        fbEl.style.display = "flex";
        let dur = trial.fb_ms;
        if (status !== "ok") {
          fbEl.className = "small";
          fbEl.textContent = "응답이 너무 늦어 다음 시행으로 넘어갑니다";
          dur = 2000;
        } else {
          fbEl.className = out.final_correct ? "fb-good" : "fb-bad";
          fbEl.textContent = out.final_correct ? "정답" : "오답";
        }
        keysEl.innerHTML = "";
        setTimeout(() => { setPhase("done"); resolve(out); }, dur);
      }
    });
  }
}
