/**
 * 미용실 외국인 손님 일러스트 (자체 제작 SVG).
 * 공감 슬라이드의 사진 자리표시를 대체합니다. 카드를 꽉 채우도록 slice.
 */
export default function CustomerScene({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="미용실에서 스마트폰을 든 외국인 손님 일러스트"
    >
      <defs>
        <linearGradient id="cs-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EEF0FF" />
          <stop offset="0.55" stopColor="#F3F1FF" />
          <stop offset="1" stopColor="#FFE9EC" />
        </linearGradient>
        <linearGradient id="cs-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4B4368" />
          <stop offset="1" stopColor="#2F2A47" />
        </linearGradient>
        <linearGradient id="cs-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6D6BE4" />
          <stop offset="1" stopColor="#4A45C4" />
        </linearGradient>
        <linearGradient id="cs-phone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#EEF0FF" />
        </linearGradient>
      </defs>

      {/* 배경 */}
      <rect width="320" height="400" fill="url(#cs-bg)" />

      {/* 장식 블롭 */}
      <circle cx="278" cy="66" r="74" fill="#DDE0FF" opacity="0.7" />
      <circle cx="40" cy="316" r="60" fill="#FFD6DC" opacity="0.6" />
      <circle cx="286" cy="250" r="10" fill="#C7CCFF" />
      <circle cx="30" cy="120" r="6" fill="#FFB4BE" />

      {/* 반짝임 */}
      {[
        { x: 250, y: 150, s: 1.1 },
        { x: 62, y: 210, s: 0.8 },
        { x: 232, y: 300, s: 0.7 },
      ].map((k, i) => (
        <path
          key={i}
          transform={`translate(${k.x} ${k.y}) scale(${k.s})`}
          d="M0,-9 C1.6,-1.6 1.6,-1.6 9,0 C1.6,1.6 1.6,1.6 0,9 C-1.6,1.6 -1.6,1.6 -9,0 C-1.6,-1.6 -1.6,-1.6 0,-9 Z"
          fill="#A9AEFF"
          opacity="0.9"
        />
      ))}

      {/* 미용실 거울 프레임 (뒤 배경 소품) */}
      <rect
        x="196"
        y="150"
        width="96"
        height="150"
        rx="48"
        fill="#ffffff"
        opacity="0.45"
      />

      {/* 인물 */}
      <g>
        {/* 뒤 머리 */}
        <path
          d="M104 196 C104 128 216 128 216 196 C216 252 206 300 196 330 L124 330 C114 300 104 252 104 196 Z"
          fill="url(#cs-hair)"
        />

        {/* 상의 / 어깨 */}
        <path
          d="M96 400 C96 336 128 306 160 306 C192 306 224 336 224 400 Z"
          fill="url(#cs-top)"
        />
        {/* 옷깃 */}
        <path
          d="M143 312 C150 326 170 326 177 312 L172 306 L148 306 Z"
          fill="#EEF0FF"
          opacity="0.9"
        />

        {/* 목 */}
        <rect x="149" y="270" width="22" height="40" rx="11" fill="#F1C7A5" />
        <path
          d="M149 285 C155 296 165 296 171 285 L171 275 L149 275 Z"
          fill="#E0AE86"
          opacity="0.5"
        />

        {/* 얼굴 */}
        <ellipse cx="160" cy="216" rx="46" ry="52" fill="#F6D0AE" />
        {/* 귀 */}
        <circle cx="114" cy="220" r="9" fill="#F1C7A5" />
        <circle cx="206" cy="220" r="9" fill="#F1C7A5" />

        {/* 앞머리 (크라운~이마를 덮는 한 겹) */}
        <path
          d="M111 206 C106 150 214 150 209 206 C205 200 202 198 200 214 C198 196 190 190 160 191 C130 190 122 196 120 214 C118 198 115 200 111 206 Z"
          fill="url(#cs-hair)"
        />
        {/* 가르마 하이라이트 */}
        <path
          d="M160 168 C158 178 158 184 160 190"
          stroke="#5A5178"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />

        {/* 눈 (편안한 감은 눈) */}
        <path
          d="M138 222 q7 7 14 0"
          stroke="#3F3A56"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M168 222 q7 7 14 0"
          stroke="#3F3A56"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* 볼터치 */}
        <ellipse cx="134" cy="238" rx="8" ry="5" fill="#FFB4BE" opacity="0.75" />
        <ellipse cx="186" cy="238" rx="8" ry="5" fill="#FFB4BE" opacity="0.75" />
        {/* 코 */}
        <path
          d="M159 230 q2 6 3 9"
          stroke="#E0AE86"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* 미소 */}
        <path
          d="M150 248 q10 9 20 0"
          stroke="#C6607A"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* 손 + 스마트폰 */}
        <g transform="rotate(-8 214 356)">
          <rect x="196" y="322" width="46" height="74" rx="12" fill="#2F2A47" />
          <rect x="200" y="326" width="38" height="66" rx="9" fill="url(#cs-phone)" />
          {/* 폰 속 말풍선 */}
          <rect x="205" y="336" width="20" height="9" rx="4.5" fill="#6D6BE4" />
          <rect x="211" y="350" width="22" height="9" rx="4.5" fill="#E2E4FF" />
          <rect x="205" y="364" width="16" height="9" rx="4.5" fill="#6D6BE4" />
        </g>
        {/* 손가락 */}
        <ellipse cx="210" cy="360" rx="16" ry="12" fill="#F6D0AE" transform="rotate(-8 210 360)" />
      </g>
    </svg>
  );
}
