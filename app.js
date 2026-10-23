'use strict';
// Настройки интеграций. Укажите ID счётчика перед запуском рекламы.
const METRIKA_ID = '';
const CONTACT_EMAIL = 'info@rusplasma.com';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const track = (goal, params = {}) => {
  if (METRIKA_ID && typeof window.ym === 'function') window.ym(Number(METRIKA_ID), 'reachGoal', goal, params);
};
if (METRIKA_ID) {
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const script = document.createElement('script'); script.async = true; script.src = 'https://mc.yandex.ru/metrika/tag.js'; document.head.append(script);
  window.ym(Number(METRIKA_ID), 'init', {clickmap: true, trackLinks: true, accurateTrackBounce: true});
}
// Анимация сохраняет весь контент доступным при выключенном JavaScript.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('has-motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), {threshold: .08, rootMargin: '0px 0px 18px 0px'});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
const video = document.querySelector('#process-video');
const videoStage = document.querySelector('#video-stage');
const videoPlay = document.querySelector('#video-play');
const videoPause = document.querySelector('#video-pause');
const videoStatus = document.querySelector('#video-status');
const kineHost = document.querySelector('#kinescope-host');
const choices = [...document.querySelectorAll('[data-video]')];
const kineVideos = {
  kinescope: {url:'https://kinescope.io/wsmPVtdpqGDFfAa5udezeL', title:'Реальная закалка', id:'kinescope-player', host:document.querySelector('#kinescope-hardening-host')},
  models: {url:'https://kinescope.io/iP1LQpPioPANiH51wBQ3Pv', title:'Модельный ряд', id:'kinescope-models-player', host:document.querySelector('#kinescope-models-host')}
};
const videoCaption = videoPlay.querySelector('.video-caption');
const originalVideoCaption = videoCaption.innerHTML;
let selectedVideo = 'local';
let requestVersion = 0;
let factoryPromise = null;
let playWhenVisible = false;
video.controls = false;
video.playsInline = true;
function showVideoStatus(message = '') {
  videoStatus.textContent = message;
  videoStatus.hidden = !message;
  if (message) {
    const link = document.createElement('a');
    link.href = kineVideos[selectedVideo]?.url || video.querySelector('source').src;
    link.textContent = ' Открыть видео';
    link.className = 'text-link';
    link.target = '_blank';
    link.rel = 'noopener';
    videoStatus.append(link);
  }
}
function setVideoState() {
  const external = selectedVideo !== 'local';
  videoPlay.hidden = external || (!video.paused && !video.ended);
  videoPause.hidden = external ? !kineVideos[selectedVideo].playing : (video.paused || video.ended);
  videoCaption.innerHTML = originalVideoCaption;
  videoPlay.removeAttribute('aria-busy');
}
function loadKinescopeFactory() {
  if (factoryPromise) return factoryPromise;
  factoryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('Kinescope timeout')), 20000);
    script.src = 'https://player.kinescope.io/latest/iframe.player.js';
    script.async = true;
    script.onerror = () => { clearTimeout(timeout); script.remove(); factoryPromise = null; reject(new Error('Kinescope unavailable')); };
    window.onKinescopeIframeAPIReady = factory => { clearTimeout(timeout); resolve(factory); };
    document.head.append(script);
  });
  return factoryPromise;
}
function loadKinescope(key) {
  const item = kineVideos[key];
  if (item.promise) return item.promise;
  item.promise = loadKinescopeFactory().then(factory => factory.create(item.id, {
    url: item.url,
    size: {width:'100%', height:'100%'},
    behavior: {autoPlay:false, muted:true, playsInline:true, localStorage:{time:false}},
    ui: {language:'ru', controls:true, mainPlayButton:true}
  })).then(player => {
    item.player = player;
    player.on(player.Events.Playing, () => {
      if (selectedVideo !== key || document.hidden) {
        player.pause().catch(() => {});
        return;
      }
      item.playing = true;
      setVideoState();
      showVideoStatus();
      track('video_play', {video:item.title});
    });
    const stopped = () => { item.playing = false; if (selectedVideo === key) setVideoState(); };
    player.on(player.Events.Pause, stopped);
    player.on(player.Events.Ended, stopped);
    player.on(player.Events.Error, () => {
      stopped();
      if (selectedVideo === key) showVideoStatus('Не удалось загрузить видео. Попробуйте ещё раз или откройте ролик отдельно.');
    });
    return player;
  }).catch(error => { item.promise = null; throw error; });
  return item.promise;
}
function pauseVideo() {
  requestVersion += 1;
  playWhenVisible = false;
  video.pause();
  Object.values(kineVideos).forEach(item => {
    item.playing = false;
    if (item.player) item.player.pause().catch(() => {});
  });
  setVideoState();
}
async function playVideo() {
  const version = ++requestVersion;
  const selected = selectedVideo;
  showVideoStatus();
  try {
    if (selected !== 'local') {
      showVideoStatus('Загрузка видео…');
      const player = await loadKinescope(selected);
      if (version !== requestVersion || selectedVideo !== selected) return;
      await player.play();
      if (version !== requestVersion && selectedVideo !== selected) await player.pause();
    } else {
      video.muted = true;
      videoCaption.textContent = 'Загрузка видео…';
      videoPlay.setAttribute('aria-busy', 'true');
      await video.play();
      if (version !== requestVersion) return;
      track('video_play', {video:'Как это работает'});
    }
  } catch (error) {
    if (version !== requestVersion) return;
    setVideoState();
    if (error.name !== 'AbortError') showVideoStatus('Не удалось запустить видео. Попробуйте ещё раз или откройте ролик отдельно.');
  }
}
async function selectVideo(button) {
  const next = button.dataset.video;
  if (next === selectedVideo) return;
  pauseVideo();
  selectedVideo = next;
  choices.forEach(choice => {
    const active = choice === button;
    choice.classList.toggle('is-active', active);
    choice.setAttribute('aria-pressed', String(active));
  });
  const external = next !== 'local';
  video.hidden = external;
  kineHost.hidden = !external;
  Object.entries(kineVideos).forEach(([key,item]) => { item.host.hidden = key !== next; });
  videoStage.style.setProperty('--video-ratio', external ? '16 / 9' : '1680 / 720');
  setVideoState();
  track('video_select', {video:button.textContent});
  if (!external) video.currentTime = 0;
  const resetVersion = requestVersion;
  if (external && kineVideos[next].player) {
    try { await kineVideos[next].player.seekTo(0); } catch (_) {}
  }
  if (resetVersion === requestVersion && selectedVideo === next) playVideo();
}
videoPlay.addEventListener('click', playVideo);
choices.forEach(button => button.addEventListener('click', () => selectVideo(button)));
videoPause.addEventListener('click', pauseVideo);
video.addEventListener('playing', () => {
  if (selectedVideo !== 'local') { video.pause(); return; }
  setVideoState(); showVideoStatus();
});
video.addEventListener('pause', setVideoState);
video.addEventListener('ended', setVideoState);
video.addEventListener('error', () => {
  if (selectedVideo !== 'local') return;
  setVideoState();
  showVideoStatus('Не удалось загрузить видео. Попробуйте обновить страницу или откройте ролик отдельно.');
});
document.querySelector('.watch-link').addEventListener('click', () => {
  playWhenVisible = true;
  const box = videoStage.getBoundingClientRect();
  if (box.top < innerHeight && box.bottom > 0) { playWhenVisible = false; playVideo(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseVideo(); });
if ('IntersectionObserver' in window) {
  const videoObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) {
      const pending = playWhenVisible;
      pauseVideo();
      playWhenVisible = pending;
    } else if (playWhenVisible) { playWhenVisible = false; playVideo(); }
  }, {threshold:0});
  videoObserver.observe(videoStage);
}
document.querySelectorAll('a[href="#comparison"]').forEach(a => a.addEventListener('click', () => { document.querySelector('#comparison').open = true; }));
document.querySelectorAll('[data-model]').forEach(link => link.addEventListener('click', () => {
  document.querySelector('#model').value = link.dataset.model;
  resetForm(); track('select_model', {model:link.dataset.model});
}));
document.querySelectorAll('[data-track]').forEach(link => link.addEventListener('click', () => track(link.dataset.track)));
document.querySelectorAll('a[href="#request"]').forEach(link => link.addEventListener('click', () => track('open_request')));
const form = document.querySelector('#request-form');
const mailStatus = document.querySelector('#mail-status');
const formError = document.querySelector('#form-error');
const submitButton = form.querySelector('button[type="submit"]');
let requestText = '';
function resetForm() { form.hidden = false; mailStatus.hidden = true; formError.hidden = true; }
function buildRequest() {
  const model = document.querySelector('#model').value;
  const task = document.querySelector('#task').value.trim();
  return `Здравствуйте!\n\nПрошу подготовить коммерческое предложение на установку плазменной закалки.\n\nМодель: ${model}\nЗадача: ${task || 'Обсудим при подборе'}\n\nМои контакты: \nКомпания: \n\nСпасибо!`;
}
form.addEventListener('submit', event => {
  event.preventDefault(); formError.hidden = true;
  if (document.querySelector('#task').value.length > 2500) {
    formError.textContent = 'Сократите описание до 2500 символов. Подробности можно приложить к письму.';
    formError.hidden = false; document.querySelector('#task').focus(); return;
  }
  submitButton.disabled = true; submitButton.textContent = 'Подготавливаем письмо…';
  requestText = buildRequest();
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Запрос КП на УДГЗ')}&body=${encodeURIComponent(requestText)}`;
  try {
    window.location.href = mailto;
    form.hidden = true; mailStatus.hidden = false;
    mailStatus.querySelector('h3').setAttribute('tabindex','-1'); mailStatus.querySelector('h3').focus({preventScroll:true});
    track('email_request_prepared', {model:document.querySelector('#model').value});
  } catch (_) { formError.textContent = `Не удалось открыть почтовую программу. Напишите на ${CONTACT_EMAIL} или позвоните +7 343 346 00 80.`; formError.hidden = false; }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Запросить КП по почте <span aria-hidden="true">↗</span>'; }
});
document.querySelector('#edit-request').addEventListener('click', () => { resetForm(); document.querySelector('#model').focus({preventScroll:true}); });
document.querySelector('#copy-request').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(requestText);
    else {
      const el = document.createElement('textarea'); el.value = requestText; el.style.position='fixed'; el.style.opacity='0'; document.body.append(el); el.select();
      const ok = document.execCommand('copy'); el.remove(); if(!ok) throw new Error('copy');
    }
    status.textContent = 'Запрос скопирован.';
  } catch (_) {
    status.textContent = 'Автоматическое копирование недоступно. Выделите текст ниже:';
    let text = document.querySelector('#copy-fallback');
    if(!text) { text = document.createElement('textarea'); text.id='copy-fallback'; text.setAttribute('aria-label','Текст запроса для копирования'); text.readOnly=true; mailStatus.append(text); }
    text.value=requestText; text.select();
  }
});
document.querySelector('#year').textContent = new Date().getFullYear();
// У почтового сценария нет события «заявка отправлена»: факт отправки сайт не получает.
