import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ExtrudeGeometry, Shape, PMREMGenerator, type Group } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const shape = new Shape();
shape.moveTo(-1.25, 1.1);
shape.lineTo(-0.64, 1.1);
shape.lineTo(0, -0.38);
shape.lineTo(0.64, 1.1);
shape.lineTo(1.25, 1.1);
shape.lineTo(0.3, -1.1);
shape.lineTo(-0.3, -1.1);
shape.closePath();
const geometry = new ExtrudeGeometry(shape, {
  depth: 0.4,
  bevelEnabled: true,
  bevelSegments: 6,
  steps: 1,
  bevelSize: 0.11,
  bevelThickness: 0.11,
});
geometry.center();
function Reflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}
function GlassV({ moving }: { moving: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ pointer, clock }) => {
    if (!group.current || !moving) return;
    group.current.rotation.y +=
      (pointer.x * 0.34 - 0.35 - group.current.rotation.y) * 0.04;
    group.current.rotation.x +=
      (-pointer.y * 0.16 + 0.12 - group.current.rotation.x) * 0.04;
    group.current.position.y = Math.sin(clock.elapsedTime * 0.65) * 0.09;
  });
  return (
    <group ref={group} scale={0.85} rotation={[0.12, -0.35, -0.12]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color="#9dd5e8"
          metalness={0.08}
          roughness={0.06}
          transmission={0.94}
          thickness={1.2}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.02}
          envMapIntensity={1.2}
        />
      </mesh>
    </group>
  );
}
export function StaticCore() {
  return (
    <svg className="static-core" viewBox="0 0 240 240" aria-hidden="true">
      <defs>
        <linearGradient id="crystal" x2="1" y2="1">
          <stop stopColor="#ddf8ff" />
          <stop offset=".4" stopColor="#5891a8" />
          <stop offset="1" stopColor="#142f42" />
        </linearGradient>
      </defs>
      <path
        d="M40 48h47l33 83 33-83h47l-61 146h-38Z"
        fill="url(#crystal)"
        stroke="#b0e5f2"
        strokeWidth="1.5"
      />
      <path
        d="m40 48 20 13h38m22 70 6 27 42-97 32-13m-99 146 6-18h25l7 18"
        fill="none"
        stroke="#ddf8ff"
        opacity=".5"
      />
    </svg>
  );
}
class CoreBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <StaticCore /> : this.props.children;
  }
}
export default function Core3D({ effects }: { effects: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting && !document.hidden),
    );
    if (holder.current) observer.observe(holder.current);
    return () => {
      document.removeEventListener("visibilitychange", update);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="core-canvas" ref={holder} aria-hidden="true">
      <CoreBoundary>
        {effects ? (
          <Canvas
            dpr={[1, 1.4]}
            frameloop={visible ? "always" : "demand"}
            camera={{ position: [0, 0, 5.5], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
            fallback={<StaticCore />}
          >
            <Reflections />
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[-3, 4, 5]}
              intensity={4}
              color="#d8faff"
            />
            <pointLight position={[3, -1, 2]} intensity={12} color="#38bdff" />
            <GlassV moving={visible} />
          </Canvas>
        ) : (
          <StaticCore />
        )}
      </CoreBoundary>
    </div>
  );
}
