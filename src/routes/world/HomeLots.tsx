import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { HOUSE_EXTERIOR_OPTIONS } from './townLayout';
import { heightAt, useTerrainVersion } from './terrain';
import { HOUSE_LOCAL, LOT_BACK, LOT_FRONT, LOT_W, MAILBOX_LOCAL, lotToWorld, type Lot } from './homeLots';

// Every student's home lot drawn in the shared world (see homeLots.ts): a dashed fence line
// around the lot, their house, the things they placed in their yard at home, and the mailbox
// every lot has, with their name over it. In Live mode the house and mailbox can be tapped.

export const MAILBOX_MODEL = '/world/models/props/mailbox.glb';
const MAILBOX_SCALE = 0.003; // the model is about 425 units tall; this makes it about 1.3 tall

function LotFence({ lot, color }: { lot: Lot; color: string }) {
  const v = useTerrainVersion();
  const line = useMemo(() => {
    const pts: number[] = [];
    const c: [number, number][] = [[-LOT_W / 2, LOT_BACK], [LOT_W / 2, LOT_BACK], [LOT_W / 2, LOT_FRONT], [-LOT_W / 2, LOT_FRONT], [-LOT_W / 2, LOT_BACK]];
    for (let k = 0; k < c.length - 1; k++) {
      const [ax, az] = c[k], [bx, bz] = c[k + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let s = 0; s < n; s++) {
        const [x, z] = lotToWorld(lot, ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n);
        pts.push(x, heightAt(x, z) + 0.06, z);
      }
    }
    pts.push(pts[0], pts[1], pts[2]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.35 }));
    l.computeLineDistances(); l.raycast = () => {};
    return l;
  }, [lot.cx, lot.cz, lot.rot, color, v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }, [line]);
  return <primitive object={line} />;
}

export function HomeLots({ lots, locked, live = false, meId, onHouse, onMailbox }: {
  lots: Lot[];
  locked: Set<string>;
  live?: boolean;
  meId?: string | null;
  onHouse?: (lot: Lot) => void;
  onMailbox?: (lot: Lot) => void;
}) {
  const worldObjects = useStore((s) => s.worldObjects);
  const homeRooms = useStore((s) => s.homeRooms);
  return (
    <>
      {lots.map((lot) => {
        const s = lot.student;
        const yard = homeRooms.find((r) => r.studentId === s.id && r.kind === 'yard');
        const items = yard ? worldObjects.filter((o) => o.studentId === s.id && o.roomId === yard.id && !o.pendingDelete) : [];
        const ext = HOUSE_EXTERIOR_OPTIONS.find((o) => o.modelPath === s.houseExteriorPath) ?? HOUSE_EXTERIOR_OPTIONS[0];
        const [hx, hz] = lotToWorld(lot, HOUSE_LOCAL[0], HOUSE_LOCAL[1]);
        const [mx, mz] = lotToWorld(lot, MAILBOX_LOCAL[0], MAILBOX_LOCAL[1]);
        const isLocked = locked.has(s.id);
        const mine = meId === s.id;
        return (
          <group key={s.id}>
            <LotFence lot={lot} color={mine ? '#22c55e' : isLocked ? '#ef4444' : '#ffffff'} />
            <Suspense fallback={null}>
              <WorldObjectRenderer
                obj={{ id: `house-${s.id}`, modelPath: ext.modelPath, label: `${s.name}'s house`, position: [hx, 0, hz], rotationY: Math.PI + lot.rot, scale: ext.scale, createdAt: '' }}
                normalize={false}
                onTerrain
                onClick={live && onHouse ? () => onHouse(lot) : undefined}
              />
              <WorldObjectRenderer
                obj={{ id: `mailbox-${s.id}`, modelPath: MAILBOX_MODEL, label: `${s.name}'s mailbox`, position: [mx, 0, mz], rotationY: lot.rot, scale: MAILBOX_SCALE, createdAt: '' }}
                normalize={false}
                onTerrain
                onClick={live && onMailbox ? () => onMailbox(lot) : undefined}
              />
              {items.map((o) => {
                const [x, z] = lotToWorld(lot, o.position[0], o.position[2]);
                return <WorldObjectRenderer key={o.id} obj={{ ...o, position: [x, o.position[1] ?? 0, z], rotationY: o.rotationY + lot.rot }} onTerrain live={live} />;
              })}
            </Suspense>
            <Html position={[mx, heightAt(mx, mz) + 1.9, mz]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ background: '#fff', border: `2px solid ${mine ? '#22c55e' : isLocked ? '#ef4444' : '#94a3b8'}`, borderRadius: 999, padding: '2px 10px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
                {isLocked ? '🔒' : '🏡'} {mine ? 'My home' : s.name}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
