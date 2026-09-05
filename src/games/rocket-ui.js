import { answerRocketQuestion, buildRocketChoices, buildRocketFormulaChoices, createRocketSession, getRocketProgress } from './rocket-session.js';
import { trackEvent, trackPageView } from '../analytics.js';

const LEVELS = [
  { id: 'egg', icon: '🥚', name: 'たまご', note: 'はなれた 3つの わくせいから えらぶ' },
  { id: 'chick', icon: '🐣', name: 'ひよこ', note: 'にている こたえから えらぶ' },
  { id: 'hen', icon: '🐔', name: 'にわとり', note: 'しきを おぼえて ブラックホールへ' },
  { id: 'star', icon: '⭐', name: 'チャレンジ', note: 'こたえから ただしい しきを さがす' },
];

export function mountRocketGame({ app, save, persist, playEffect, getReading, speak, onExit }) {
  save.rocket ??= { tables: {}, mastery: {} };
  let dan = null;
  let levelIndex = 0;
  let session = null;
  let locked = false;
  let choices = [];
  let questionStartedAt = 0;
  let hideTimer = null;

  function getPlayerName() {
    let name = localStorage.getItem('playerName');
    if (!name) {
      name = prompt('お名前を入力してください', 'たろう')
      localStorage.setItem('playerName', name);
    }
    return name;
  }

  function tableProgress(table) {
    return save.rocket.tables[table] || { completedLevel: -1, best: {} };
  }

  function renderTables() {
    window.scrollTo(0, 0);
    clearTimeout(hideTimer);
    session = null;
    app.innerHTML = `<header class="rocket-header"><button id="rocket-exit" class="nav-back">‹ ゲームいちらん</button><div><p class="eyebrow">ばらばら 九九に ちょうせん</p><h1>🚀 九九ロケット</h1></div></header>
      <section class="rocket-welcome"><div>🚀　🪐</div><h2>どの だんで とぶ？</h2><p>じゅんばんなしで こたえて、ほしへ すすもう。</p></section>
      <div class="rocket-table-grid">${Array.from({ length: 9 }, (_, i) => i + 1).map((table) => `<button data-rocket-dan="${table}"><span>🚀</span><strong>${table}のだん</strong><small>しゅっぱつ</small></button>`).join('')}</div>`;
    document.querySelector('#rocket-exit').addEventListener('click', onExit);
    document.querySelectorAll('[data-rocket-dan]').forEach((button) => button.addEventListener('click', () => { const picked = Number(button.dataset.rocketDan); trackEvent('game_open', { game: 'rocket', dan: picked }); trackPageView('/rocket/' + picked, `九九ロケット ${picked}のだん`); dan = picked; renderLevels(); }));
  }

  function renderLevels() {
    window.scrollTo(0, 0);
    clearTimeout(hideTimer);
    session = null;
    app.innerHTML = `<header class="rocket-header"><nav class="game-nav" aria-label="もどる"><button id="rocket-exit" class="nav-back">‹ ゲームいちらん</button><button id="rocket-back" class="nav-home" aria-label="だんをえらぶ">⌂</button></nav><div><p class="eyebrow">九九ロケット</p><h1>🚀 ${dan}のだん</h1></div></header>
      <section class="rocket-level-intro"><span>🪐</span><div><h2>どこまで とぶ？</h2><p>じかんは きにしなくて だいじょうぶ。</p></div></section>
      <div class="rocket-levels">${LEVELS.map((level, index) => `<button data-rocket-level="${index}"><span>${level.icon}</span><span><strong>${level.name}</strong><small>${level.note}</small></span><em>🚀 しゅっぱつ</em></button>`).join('')}</div>`;
    document.querySelector('#rocket-exit').addEventListener('click', onExit);
    document.querySelector('#rocket-back').addEventListener('click', renderTables);
    document.querySelectorAll('[data-rocket-level]').forEach((button) => button.addEventListener('click', () => startLevel(Number(button.dataset.rocketLevel))));
  }

  function startLevel(index) {
    levelIndex = index;
    const completedTables = Object.keys(save.completed || {}).map(Number);
    session = createRocketSession(dan, LEVELS[index].id, { completedTables, masteryById: save.rocket.mastery });
    locked = false;
    choices = levelIndex === 3
      ? buildRocketFormulaChoices(session.currentQuestion)
      : buildRocketChoices(session.currentQuestion, Math.random, LEVELS[levelIndex].id);
    questionStartedAt = Date.now();
    renderQuestion();
    setTimeout(readQuestion, 300);
  }

  function readQuestion() {
    if (!session?.currentQuestion) return;
    const questionId = session.currentQuestion.id;
    const reading = getReading(session.currentQuestion);
    const text = levelIndex === 3
      ? `こたえが ${session.currentQuestion.answer} になる ${dan}のだんは どれ`
      : reading?.standard.prompt || `${session.currentQuestion.multiplicand} かける ${session.currentQuestion.multiplier} は`;
    document.querySelector('.rocket-equation')?.classList.remove('blackhole-hidden');
    speak(text);
    clearTimeout(hideTimer);
    if (levelIndex === 2) {
      hideTimer = setTimeout(() => {
        if (session?.currentQuestion?.id === questionId) document.querySelector('.rocket-equation')?.classList.add('blackhole-hidden');
      }, 1400);
    }
  }

  function renderQuestion(message = 'せいかいの わくせいを えらぼう！', mood = 'ready') {
    window.scrollTo(0, 0);
    const q = session.currentQuestion;
    const progress = getRocketProgress(session);
    app.innerHTML = `<header class="rocket-game-header compact-game-header"><nav class="game-nav" aria-label="もどる"><button id="rocket-game-exit" class="nav-back" aria-label="ゲームいちらんへもどる">‹ いちらん</button><button id="rocket-quit" class="nav-home" aria-label="レベルをえらぶ">⌂</button></nav><strong>${LEVELS[levelIndex].icon} ${LEVELS[levelIndex].name}</strong><span>${progress.answered + 1} / 9</span></header>
      <section class="rocket-game-card" data-mood="${mood}">
        <div class="rocket-progress"><i style="width:${progress.percent}%"></i></div>
        ${levelIndex === 3
    ? `<h1 class="rocket-equation rocket-answer-mission"><span>こたえは</span>${q.answer}</h1>`
    : `<h1 class="rocket-equation ${levelIndex === 2 ? 'blackhole-hidden' : ''}">${q.multiplicand}<small>×</small>${q.multiplier}<small>＝</small><b>？</b></h1>`}
        <button class="rocket-listen" id="rocket-listen">🔊 もんだいを きく</button>
        <p class="rocket-message" id="rocket-message" role="status">${message}</p>
        <div class="planet-choice-scene">
          <span class="rocket-sky" aria-hidden="true">⭐　　☄️　　⭐</span>
          <div class="planet-choices ${levelIndex === 3 ? 'formula-planets' : ''}">${choices.map((choice, index) => { const label = levelIndex === 3 ? `${dan}×${choice}` : choice; return `<button data-planet-choice="${choice}" aria-label="${label}の わくせい"><span>${['🟣','🟠','🔵'][index]}</span><strong>${label}</strong></button>`; }).join('')}</div>
          <span class="choice-rocket" aria-hidden="true">🚀</span>
          <span class="rocket-flame" aria-hidden="true">🔥</span>
        </div>
      </section>`;
    document.querySelector('#rocket-game-exit').addEventListener('click', onExit);
    document.querySelector('#rocket-quit').addEventListener('click', renderLevels);
    document.querySelector('#rocket-listen').addEventListener('click', readQuestion);
    document.querySelectorAll('[data-planet-choice]').forEach((button) => button.addEventListener('click', () => choosePlanet(Number(button.dataset.planetChoice), button)));
  }

  function choosePlanet(value, button) {
    if (locked) return;
    const correctChoice = levelIndex === 3 ? session.currentQuestion.multiplier : session.currentQuestion.answer;
    if (value !== correctChoice) {
      locked = true;
      const wrongLabel = levelIndex === 3 ? `${dan}×${value}` : value;
      button.classList.add('wrong-planet');
      document.querySelector('.choice-rocket')?.classList.add('rocket-orbit-back');
      playEffect('try-again', save.effects);
      document.querySelector('.rocket-message').textContent = `${wrongLabel}の わくせいじゃ ないみたい。もういちど！`;
      setTimeout(() => {
        if (!session?.currentQuestion) return;
        locked = false;
        renderQuestion('べつの わくせいを えらんでみよう', 'wrong');
      }, 900);
      return;
    }
    const target = [...button.parentElement.children].indexOf(button);
    locked = true;
    button.classList.add('right-planet');
    document.querySelector('.choice-rocket')?.classList.add(`fly-planet-${target}`);
    playEffect('correct', save.effects);
    const label = levelIndex === 3 ? `${dan}×${value}` : value;
    setTimeout(() => submitAnswer(session.currentQuestion.answer, `${label}の わくせいに とうちゃく！`), 600);
  }

  function submitAnswer(value, heard) {
    const q = session.currentQuestion;
    const result = answerRocketQuestion(session, value, Date.now() - questionStartedAt);
    session = result.state; save.rocket.mastery = session.masteryById; persist();
    const message = `${heard} ${q.multiplicand} × ${q.multiplier} ＝ ${q.answer}`;
    if (session.completed) { setTimeout(() => finishLevel(message), 700); return; }
    renderQuestion(message, 'correct');
    setTimeout(() => {
      if (!session?.currentQuestion) return;
      locked = false;
      choices = levelIndex === 3
        ? buildRocketFormulaChoices(session.currentQuestion)
        : buildRocketChoices(session.currentQuestion, Math.random, LEVELS[levelIndex].id);
      questionStartedAt = Date.now();
      renderQuestion();
      setTimeout(readQuestion, 250);
    }, 950);
  }

  function finishLevel(lastMessage) {
    window.scrollTo(0, 0);
    playEffect('hatch', save.effects);
    const progress = getRocketProgress(session);
    // analytics: rocket level complete
    try { trackEvent('game_complete', { game: 'rocket', dan, level: LEVELS[levelIndex].id, correct: progress.correct, total: progress.answered || 9 }); } catch (e) { console.debug('analytics error', e); }
    const stored = tableProgress(dan);
    stored.completedLevel = Math.max(stored.completedLevel, levelIndex); stored.best[LEVELS[levelIndex].id] = Math.max(stored.best[LEVELS[levelIndex].id] || 0, progress.correct); save.rocket.tables[dan] = stored; persist();

    async function sendScoreToServer(playerName, score) {
      try{
        const response = await fetch('http://127.0.0.1:8000/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_name: playerName, score: score }),
        });
        console.log('Score sent:', await response.json());
      } catch (e) {
        console.error('Failed to send score', e);
      }
    }

    sendScoreToServer(getPlayerName(), progress.correct);

    app.innerHTML = `<nav class="game-nav" aria-label="もどる"><button id="rocket-finish-exit" class="nav-back">‹ ゲームいちらん</button><button id="rocket-finish-levels" class="nav-home" aria-label="レベルをえらぶ">⌂</button></nav><section class="rocket-finish"><div>🚀✨🪐</div><p class="eyebrow">ほしに とうちゃく！</p><h1>9もん できた！</h1><p>${lastMessage}</p><p>${progress.correct}もん せいかいしたよ。</p><div><button id="rocket-again">もういちど</button><button id="rocket-next">${levelIndex < 3 ? 'つぎの レベル' : 'だんを えらぶ'}</button></div></section>`;
    document.querySelector('#rocket-finish-exit').addEventListener('click', onExit);
    document.querySelector('#rocket-finish-levels').addEventListener('click', renderLevels);
    document.querySelector('#rocket-again').addEventListener('click', () => startLevel(levelIndex));
    document.querySelector('#rocket-next').addEventListener('click', () => levelIndex < 3 ? startLevel(levelIndex + 1) : renderTables());
  }

  renderTables();
}
