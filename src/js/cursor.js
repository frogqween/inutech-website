import { gsap } from 'gsap';

const SPIN_DURATION = 2;
const HOVER_DURATION = 0.2;
const PARALLAX_ON = true;
const TARGET_SELECTOR = 'a, button';
const BORDER_WIDTH = 3;
const CORNER_SIZE = 12;

function isMobile() {
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return (hasTouchScreen && isSmallScreen) || mobileRegex.test(userAgent.toLowerCase());
}

function initCursor() {
  if (isMobile()) return;

  // Inject cursor DOM
  const cursor = document.createElement('div');
  cursor.className = 'target-cursor-wrapper';
  cursor.innerHTML = `
    <div class="target-cursor-dot"></div>
    <div class="target-cursor-corner corner-tl"></div>
    <div class="target-cursor-corner corner-tr"></div>
    <div class="target-cursor-corner corner-br"></div>
    <div class="target-cursor-corner corner-bl"></div>
  `;
  document.body.appendChild(cursor);

  const dot = cursor.querySelector('.target-cursor-dot');
  const corners = cursor.querySelectorAll('.target-cursor-corner');

  document.body.style.cursor = 'none';

  let spinTl = null;
  let activeTarget = null;
  let currentLeaveHandler = null;
  let resumeTimeout = null;
  const activeStrengthRef = { current: 0 };
  let targetCornerPositions = null;

  gsap.set(cursor, {
    xPercent: -50,
    yPercent: -50,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });

  const createSpinTimeline = () => {
    if (spinTl) spinTl.kill();
    spinTl = gsap.timeline({ repeat: -1 })
      .to(cursor, { rotation: '+=360', duration: SPIN_DURATION, ease: 'none' });
  };
  createSpinTimeline();

  const tickerFn = () => {
    if (!targetCornerPositions || activeStrengthRef.current === 0) return;

    const strength = activeStrengthRef.current;
    const cursorX = gsap.getProperty(cursor, 'x');
    const cursorY = gsap.getProperty(cursor, 'y');

    Array.from(corners).forEach((corner, i) => {
      const currentX = gsap.getProperty(corner, 'x');
      const currentY = gsap.getProperty(corner, 'y');
      const targetX = targetCornerPositions[i].x - cursorX;
      const targetY = targetCornerPositions[i].y - cursorY;
      const finalX = currentX + (targetX - currentX) * strength;
      const finalY = currentY + (targetY - currentY) * strength;
      const duration = strength >= 0.99 ? (PARALLAX_ON ? 0.2 : 0) : 0.05;
      gsap.to(corner, {
        x: finalX,
        y: finalY,
        duration,
        ease: duration === 0 ? 'none' : 'power1.out',
        overwrite: 'auto'
      });
    });
  };

  const cleanupTarget = (target) => {
    if (currentLeaveHandler) {
      target.removeEventListener('mouseleave', currentLeaveHandler);
    }
    currentLeaveHandler = null;
  };

  window.addEventListener('mousemove', e => {
    gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.1, ease: 'power3.out' });
  });

  window.addEventListener('scroll', () => {
    if (!activeTarget) return;
    const mouseX = gsap.getProperty(cursor, 'x');
    const mouseY = gsap.getProperty(cursor, 'y');
    const el = document.elementFromPoint(mouseX, mouseY);
    const isStillOver = el && (el === activeTarget || el.closest(TARGET_SELECTOR) === activeTarget);
    if (!isStillOver && currentLeaveHandler) currentLeaveHandler();
  }, { passive: true });

  window.addEventListener('mousedown', () => {
    gsap.to(dot, { scale: 0.7, duration: 0.3 });
    gsap.to(cursor, { scale: 0.9, duration: 0.2 });
  });

  window.addEventListener('mouseup', () => {
    gsap.to(dot, { scale: 1, duration: 0.3 });
    gsap.to(cursor, { scale: 1, duration: 0.2 });
  });

  window.addEventListener('mouseover', e => {
    let current = e.target;
    let target = null;
    while (current && current !== document.body) {
      if (current.matches && current.matches(TARGET_SELECTOR)) { target = current; break; }
      current = current.parentElement;
    }
    if (!target || activeTarget === target) return;
    if (activeTarget) cleanupTarget(activeTarget);
    if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }

    activeTarget = target;
    Array.from(corners).forEach(corner => gsap.killTweensOf(corner));
    gsap.killTweensOf(cursor, 'rotation');
    spinTl?.pause();
    gsap.set(cursor, { rotation: 0 });

    const rect = target.getBoundingClientRect();
    const cursorX = gsap.getProperty(cursor, 'x');
    const cursorY = gsap.getProperty(cursor, 'y');

    targetCornerPositions = [
      { x: rect.left - BORDER_WIDTH,                        y: rect.top - BORDER_WIDTH },
      { x: rect.right + BORDER_WIDTH - CORNER_SIZE,         y: rect.top - BORDER_WIDTH },
      { x: rect.right + BORDER_WIDTH - CORNER_SIZE,         y: rect.bottom + BORDER_WIDTH - CORNER_SIZE },
      { x: rect.left - BORDER_WIDTH,                        y: rect.bottom + BORDER_WIDTH - CORNER_SIZE }
    ];

    gsap.ticker.add(tickerFn);
    gsap.to(activeStrengthRef, { current: 1, duration: HOVER_DURATION, ease: 'power2.out' });

    Array.from(corners).forEach((corner, i) => {
      gsap.to(corner, {
        x: targetCornerPositions[i].x - cursorX,
        y: targetCornerPositions[i].y - cursorY,
        duration: 0.2,
        ease: 'power2.out'
      });
    });

    const leaveHandler = () => {
      gsap.ticker.remove(tickerFn);
      targetCornerPositions = null;
      gsap.set(activeStrengthRef, { current: 0, overwrite: true });
      activeTarget = null;

      const cornersList = Array.from(corners);
      gsap.killTweensOf(cornersList);
      const positions = [
        { x: -CORNER_SIZE * 1.5, y: -CORNER_SIZE * 1.5 },
        { x:  CORNER_SIZE * 0.5, y: -CORNER_SIZE * 1.5 },
        { x:  CORNER_SIZE * 0.5, y:  CORNER_SIZE * 0.5 },
        { x: -CORNER_SIZE * 1.5, y:  CORNER_SIZE * 0.5 }
      ];
      const tl = gsap.timeline();
      cornersList.forEach((corner, i) => {
        tl.to(corner, { x: positions[i].x, y: positions[i].y, duration: 0.3, ease: 'power3.out' }, 0);
      });

      resumeTimeout = setTimeout(() => {
        if (!activeTarget && spinTl) {
          const normalized = gsap.getProperty(cursor, 'rotation') % 360;
          spinTl.kill();
          spinTl = gsap.timeline({ repeat: -1 })
            .to(cursor, { rotation: '+=360', duration: SPIN_DURATION, ease: 'none' });
          gsap.to(cursor, {
            rotation: normalized + 360,
            duration: SPIN_DURATION * (1 - normalized / 360),
            ease: 'none',
            onComplete: () => spinTl?.restart()
          });
        }
        resumeTimeout = null;
      }, 50);

      cleanupTarget(target);
    };

    currentLeaveHandler = leaveHandler;
    target.addEventListener('mouseleave', leaveHandler);
  }, { passive: true });
}

initCursor();
