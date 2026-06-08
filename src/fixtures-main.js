import './styles.css';
import './engine/lab.css';
import { createLab } from './engine/index.js';
import { FIXTURES } from './engine/fixtures.js';

const app = document.getElementById('app');
app.innerHTML = `
  <div class="fx-wrap">
    <div class="eyebrow">Engine Fixtures · M0</div>
    <h1>create<span class="em">Lab</span></h1>
    <p class="lede" id="fxBlurb"></p>

    <div class="fx-seg" id="fxSel"></div>

    <div class="fx-controls">
      <button class="play" id="fxPlay">▶ Play</button>
      <div class="fx-seg" id="fxMode">
        <button data-m="tie" class="on">Tied</button>
        <button data-m="restruck">Re-struck</button>
      </div>
      <div class="fx-seg" id="fxHands">
        <button data-h="both" class="on">Both</button>
        <button data-h="right">RH</button>
        <button data-h="left">LH</button>
      </div>
      <label class="fx-tempo">Tempo <b id="fxBpm">60</b>
        <input id="fxTempo" type="range" min="40" max="100" step="2" value="60" />
      </label>
    </div>

    <div class="card"><div id="labHost"></div></div>
  </div>`;

const host = document.getElementById('labHost');
const blurb = document.getElementById('fxBlurb');
const selWrap = document.getElementById('fxSel');
const playBtn = document.getElementById('fxPlay');

let lab = null;
let bpm = 60;
let mode = 'tie';
let hands = 'both';
let playing = false;

FIXTURES.forEach((f, i) => {
  const b = document.createElement('button');
  b.textContent = f.name;
  b.dataset.i = i;
  if (i === 0) b.classList.add('on');
  selWrap.appendChild(b);
});

function setPlayBtn() { playBtn.textContent = playing ? '■ Stop' : '▶ Play'; }

function mount(i) {
  if (lab) lab.destroy();
  playing = false;
  setPlayBtn();
  blurb.textContent = FIXTURES[i].blurb;
  [...selWrap.children].forEach((c, k) => c.classList.toggle('on', k === i));
  lab = createLab(host, { notation: FIXTURES[i].notation, tempoBpm: bpm, mode, hands });
}

selWrap.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) mount(+b.dataset.i);
});
playBtn.addEventListener('click', () => {
  if (!lab) return;
  if (playing) { lab.stop(); playing = false; } else { lab.play(); playing = true; }
  setPlayBtn();
});
document.getElementById('fxMode').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  [...e.currentTarget.children].forEach((x) => x.classList.remove('on'));
  b.classList.add('on');
  mode = b.dataset.m;
  if (lab) lab.setMode(mode);
});
document.getElementById('fxHands').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  [...e.currentTarget.children].forEach((x) => x.classList.remove('on'));
  b.classList.add('on');
  hands = b.dataset.h;
  if (lab) lab.setHands(hands);
});
const tempo = document.getElementById('fxTempo');
tempo.addEventListener('input', () => {
  bpm = +tempo.value;
  document.getElementById('fxBpm').textContent = bpm;
  if (lab) lab.setTempo(bpm);
});

mount(0);
