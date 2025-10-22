import StarfieldCanvas from "~/components/StarfieldCanvas";

export default function Index() {
  return (
    <div className="relative h-screen w-screen bg-black flex items-center justify-center select-none">
      <StarfieldCanvas
        count={500}
        sensitivity={0.1}
        depthFade={0.8}
        dotSize={1}
      />
      <div className="absolute inset-0 grid place-items-center text-white z-2">
        <div className="relative">
          {/* Radial glow background */}
          <div
            className="absolute inset-0 -m-8 bg-white/15 rounded-full blur-xl"
            style={{
              animation: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          ></div>
          {/* Logo */}
          <img
            src="/logo_mark.svg"
            alt="Aarstiderne Logo"
            className="relative w-10 h-auto filter brightness-0 invert user-select-none pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
