import React, { useId } from "react";
import type { Reading } from "@/lib/model";

export function DeviceVisual({
  reading,
  fresh,
}: {
  reading: Reading | null;
  fresh: boolean;
}) {
  const holes = useId();
  const green = fresh && reading?.greenLED === true;
  const red =
    fresh && (reading?.redLED === true || reading?.redLEDBlinking === true);
  const motion = fresh && reading?.motionLED === true;

  return (
    <svg className="device-visual" viewBox="0 0 340 250" aria-hidden="true">
      <defs>
        <pattern
          id={holes}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="6" cy="6" r="1.4" fill="#a9b1b5" />
        </pattern>
      </defs>
      <rect
        x="9"
        y="10"
        width="322"
        height="228"
        rx="9"
        fill="#eef0ed"
        stroke="#b3bcb8"
      />
      <rect x="22" y="37" width="296" height="176" fill={`url(#${holes})`} />
      <path d="M23 23H317 M23 225H317" stroke="#b33d3d" strokeWidth="2" />
      <path d="M23 29H317 M23 219H317" stroke="#397799" strokeWidth="2" />
      <path d="M183 38V211" stroke="#d2d9d5" strokeWidth="7" />
      <rect
        x="44"
        y="46"
        width="110"
        height="159"
        rx="6"
        fill="#202b32"
        stroke="#62716a"
        strokeWidth="2"
      />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i} fill="#aeb9b2">
          <rect x="38" y={53 + i * 12} width="12" height="5" rx="1" />
          <rect x="148" y={53 + i * 12} width="12" height="5" rx="1" />
        </g>
      ))}
      <rect x="81" y="39" width="35" height="24" rx="3" fill="#aeb9b2" />
      <rect x="87" y="42" width="23" height="9" rx="2" fill="#35433e" />
      <rect x="62" y="98" width="74" height="75" rx="3" fill="#bac4be" />
      <text
        x="99"
        y="130"
        textAnchor="middle"
        fill="#202b32"
        fontSize="15"
        fontWeight="650"
      >
        ESP32
      </text>
      <text x="99" y="150" textAnchor="middle" fill="#35433e" fontSize="10">
        DevKit V1
      </text>
      <path
        d="M69 195V181H79V191H89V181H99V191H109V181H129"
        fill="none"
        stroke="#c4af77"
        strokeWidth="2"
      />
      <circle
        data-led="motion"
        data-active={motion}
        cx="70"
        cy="79"
        r="5"
        fill={motion ? "#399bf1" : "#52616c"}
        stroke={motion ? "#c3e5ff" : "#89969f"}
        strokeWidth="2"
      />
      <text x="82" y="83" fill="#e4ece7" fontSize="10">
        MOTION
      </text>
      <path
        d="M158 113H196V77H247 M158 149H208V166H247"
        fill="none"
        stroke="#847351"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {[77, 166].map((y) => (
        <g key={y}>
          <rect
            x="216"
            y={y - 5}
            width="23"
            height="10"
            rx="3"
            fill="#9cc0c8"
            stroke="#537781"
          />
          <path
            d={`M222 ${y - 5}v10 M227 ${y - 5}v10 M233 ${y - 5}v10`}
            stroke="#635443"
            strokeWidth="2"
          />
          <path
            d={`M263 ${y + 8}v17h39v-2`}
            fill="none"
            stroke="#64716c"
            strokeWidth="2"
          />
        </g>
      ))}
      <circle
        data-led="green"
        data-active={green}
        cx="260"
        cy="77"
        r="15"
        fill={green ? "#37bd6a" : "#53695b"}
        stroke={green ? "#176d37" : "#3d5144"}
        strokeWidth="2"
      />
      <circle cx="255" cy="72" r="4" fill={green ? "#deffe7" : "#90a096"} />
      <text x="260" y="116" textAnchor="middle" fill="#35433e" fontSize="12">
        Green LED
      </text>
      <circle
        data-led="red"
        data-active={red}
        cx="260"
        cy="166"
        r="15"
        fill={red ? "#ed5555" : "#805c5c"}
        stroke={red ? "#a02626" : "#624646"}
        strokeWidth="2"
      />
      <circle cx="255" cy="161" r="4" fill={red ? "#ffe4df" : "#b19a9a"} />
      <text x="260" y="205" textAnchor="middle" fill="#35433e" fontSize="12">
        Red LED
      </text>
    </svg>
  );
}
