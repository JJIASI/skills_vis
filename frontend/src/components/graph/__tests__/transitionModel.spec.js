import { planTransition } from '../transitionModel.js';
import { describe, test, expect } from 'vitest';

describe('planTransition', () => {
  test('classifies matched, entering, and exiting nodes by path', () => {
    const fromScene = {
      nodes: [
        { path: '/a', x: 0, y: 0 },
        { path: '/c', x: 2, y: 2 }
      ]
    };
    const toScene = {
      nodes: [
        { path: '/a', x: 5, y: 0 },
        { path: '/b', x: 10, y: 10, parentAnchor: { x: 100, y: 200 } }
      ]
    };

    const result = planTransition(fromScene, toScene);

    const matchedPaths = result.matched.map(m => m.path);
    const enteringPaths = result.entering.map(e => e.path);
    const exitingPaths = result.exiting.map(e => e.path);

    expect(matchedPaths).toEqual(['/a']);
    expect(enteringPaths).toEqual(['/b']);
    expect(exitingPaths).toEqual(['/c']);
  });

  test('entering/exiting include parent-anchor fallback', () => {
    const fromScene = {
      nodes: [
        { path: '/c', x: 2, y: 2 } // no parentAnchor
      ]
    };
    const toScene = {
      nodes: [
        { path: '/b', x: 10, y: 10, parentAnchor: { x: 100, y: 200 } }
      ]
    };

    const result = planTransition(fromScene, toScene);

    expect(result.entering[0].anchor).toEqual({ x: 100, y: 200 });
    // exiting fallback to node's own coords
    expect(result.exiting[0].anchor).toEqual({ x: 2, y: 2 });
  });

  test('changedCount includes entering, exiting, and moved matched', () => {
    const fromScene = {
      nodes: [
        { path: '/a', x: 0, y: 0 },
        { path: '/c', x: 2, y: 2 }
      ]
    };
    const toScene = {
      nodes: [
        { path: '/a', x: 5, y: 0 }, // moved
        { path: '/b', x: 10, y: 10 }
      ]
    };

    const result = planTransition(fromScene, toScene);

    expect(result.changedCount).toBeGreaterThan(0);
    // exactly: entering 1 + exiting 1 + moved matched 1 = 3
    expect(result.changedCount).toEqual(3);
  });
});
