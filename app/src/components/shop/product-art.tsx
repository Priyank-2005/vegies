import type { ReactNode } from "react";

/**
 * Hand-built vector illustrations for the catalogue: one shape per kind of vegetable, recoloured per product.
 * They stand in for photography (a real photo replaces this when a product gets an image). Pure SVG, no raster
 * assets, no gradient ids (so many can sit on one page without id clashes): depth comes from a darker offset
 * shape, a light highlight and a soft ground shadow.
 */

export interface Pal {
  /** main body colour */
  m: string;
  /** darker shade (outline, crescent shadow, ridges) */
  d: string;
  /** lighter shade (highlights, flesh) */
  l: string;
  /** green used for leaves and stems where a product has them */
  g?: string;
  /** background tint of the tile (defaults to `m`) */
  t?: string;
}

type Kind =
  | "tomato" | "onion" | "potato" | "sweetpotato" | "beet" | "carrot" | "radish" | "ginger" | "garlic" | "lemon"
  | "capsicum" | "chilli" | "cabbage" | "cauliflower" | "brinjal" | "okra" | "bottlegourd" | "cucumber" | "bittergourd"
  | "ridgegourd" | "pumpkin" | "arbi" | "peas" | "beans" | "drumstick" | "mushroom" | "leafy" | "springonion" | "generic";

const LEAF = "#2f8f46";
const LEAF_D = "#1f6b33";

function Shadow({ rx = 58, cy = 177 }: { rx?: number; cy?: number }) {
  return <ellipse cx="100" cy={cy} rx={rx} ry="7" fill="#000" opacity=".13" />;
}
function Gloss({ cx, cy, rx = 14, ry = 8, rot = -30, o = 0.32 }: { cx: number; cy: number; rx?: number; ry?: number; rot?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity={o} transform={`rotate(${rot} ${cx} ${cy})`} />;
}
function Calyx({ g, cx = 100, cy = 56, s = 1 }: { g: string; cx?: number; cy?: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d="M0 4C-12 8-30 4-38 14C-22 14-12 22 0 18C12 22 22 14 38 14C30 4 12 8 0 4Z" fill={g} />
      <path d="M0 10C-8 20-20 30-26 36C-12 32-4 28 0 22C4 28 12 32 26 36C20 30 8 20 0 10Z" fill={g} />
      <rect x="-3" y="-12" width="6" height="18" rx="2" fill={LEAF_D} />
    </g>
  );
}

function Tomato({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow />
      <ellipse cx="102" cy="108" rx="64" ry="58" fill={p.d} />
      <ellipse cx="98" cy="103" rx="62" ry="55" fill={p.m} />
      <Gloss cx={68} cy={84} rx={15} ry={8} />
      <Calyx g={p.g ?? LEAF} cy={52} />
    </g>
  );
}

function Onion({ p }: { p: Pal }) {
  const body = "M100 34C104 52 156 66 158 114C160 152 132 170 100 170C68 170 40 152 42 114C44 66 96 52 100 34Z";
  return (
    <g>
      <Shadow rx={52} />
      <path d={body} fill={p.d} transform="translate(4 3)" />
      <path d={body} fill={p.m} />
      <path d="M100 40C80 80 70 130 100 168M100 40C118 82 128 130 100 168M100 44C60 80 54 130 76 160M100 44C140 80 146 130 124 160" stroke={p.l} strokeWidth="2.2" fill="none" opacity=".55" />
      <path d="M96 38C98 26 102 26 104 38" stroke={p.d} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M90 172l-6 8M100 172v9M110 172l6 8" stroke={p.d} strokeWidth="2.5" strokeLinecap="round" />
      <Gloss cx={72} cy={96} rx={10} ry={20} rot={12} o={0.22} />
    </g>
  );
}

function Garlic({ p }: { p: Pal }) {
  const body = "M100 40C104 56 150 70 156 116C160 150 132 168 100 168C68 168 40 150 44 116C50 70 96 56 100 40Z";
  return (
    <g>
      <Shadow rx={52} />
      <path d={body} fill={p.d} transform="translate(3 3)" />
      <path d={body} fill={p.m} />
      <path d="M100 48C74 78 66 130 92 166M100 48C126 78 134 130 108 166M100 52C58 82 54 132 72 160M100 52C142 82 146 132 128 160" stroke={p.d} strokeWidth="2.4" fill="none" opacity=".45" />
      <path d="M95 44C97 28 103 28 105 44" stroke={p.l} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M88 170l-4 8M100 170v9M112 170l4 8" stroke={p.d} strokeWidth="2.4" strokeLinecap="round" />
      <Gloss cx={70} cy={100} rx={9} ry={22} rot={12} o={0.45} />
    </g>
  );
}

function Potato({ p }: { p: Pal }) {
  const body = "M42 112C40 78 72 56 108 58C146 58 164 86 158 120C152 152 124 166 90 162C58 158 44 142 42 112Z";
  const eyes: Array<[number, number]> = [[70, 96], [112, 80], [128, 126], [86, 138], [58, 124], [140, 96]];
  return (
    <g>
      <Shadow rx={60} />
      <path d={body} fill={p.d} transform="translate(4 4)" />
      <path d={body} fill={p.m} />
      {eyes.map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3.4" ry="2.4" fill={p.d} opacity=".65" />
      ))}
      <Gloss cx={78} cy={82} rx={18} ry={8} rot={-25} o={0.28} />
    </g>
  );
}

function SweetPotato({ p }: { p: Pal }) {
  const body = "M26 124C34 92 88 74 140 82C176 88 182 118 150 134C114 152 56 156 26 124Z";
  return (
    <g transform="rotate(-8 100 110)">
      <Shadow rx={68} cy={172} />
      <path d={body} fill={p.d} transform="translate(2 5)" />
      <path d={body} fill={p.m} />
      <path d="M44 118C80 108 120 104 160 112M52 130C88 130 120 126 150 124" stroke={p.d} strokeWidth="2" fill="none" opacity=".5" />
      <Gloss cx={86} cy={96} rx={26} ry={6} rot={-6} o={0.3} />
    </g>
  );
}

function Beet({ p }: { p: Pal }) {
  const stem = p.g ?? LEAF;
  return (
    <g>
      <Shadow rx={52} />
      <path d="M96 76C96 52 80 36 70 26M104 76C104 50 112 34 130 24M100 76C100 54 100 38 100 22" stroke={p.d} strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M70 30C52 36 46 18 56 8C74 10 80 20 70 30ZM130 28C148 30 156 14 148 4C128 4 122 16 130 28ZM100 26C86 20 88 4 100 0C112 4 114 20 100 26Z" fill={stem} />
      <path d="M100 168C98 178 102 186 106 192" stroke={p.d} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="103" cy="122" rx="54" ry="48" fill={p.d} />
      <ellipse cx="100" cy="118" rx="52" ry="46" fill={p.m} />
      <path d="M58 104C84 96 118 96 142 104M52 124C84 116 118 116 148 124" stroke={p.d} strokeWidth="2" fill="none" opacity=".45" />
      <Gloss cx={72} cy={100} rx={14} ry={8} />
    </g>
  );
}

function Taper({ p, half, tip = 188, leaves }: { p: Pal; half: number; tip?: number; leaves: boolean }) {
  const w = half;
  const body = `M${100 - w} 66C${100 - w} 56 ${100 + w} 56 ${100 + w} 66C${100 + w} 108 ${100 + w * 0.5} 152 100 ${tip}C${100 - w * 0.5} 152 ${100 - w} 108 ${100 - w} 66Z`;
  const rings = [84, 104, 124, 144];
  return (
    <g transform="rotate(26 100 112) scale(.95) translate(5 4)">
      {leaves ? (
        <g fill={p.g ?? LEAF}>
          <path d="M100 62C84 44 74 24 78 6C92 20 100 40 100 62Z" />
          <path d="M100 62C104 40 114 22 130 12C130 32 118 50 100 62Z" />
          <path d="M100 62C94 36 100 18 100 2C108 22 108 44 100 62Z" fill={p.g ? LEAF_D : "#237a3a"} />
        </g>
      ) : null}
      <path d={body} fill={p.d} transform="translate(3 2)" />
      <path d={body} fill={p.m} />
      {rings.map((y, i) => {
        const hw = w * (1 - i * 0.2);
        return <path key={y} d={`M${100 - hw * 0.8} ${y}q${hw * 0.5} 7 ${hw * 0.9} 2`} stroke={p.d} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".6" />;
      })}
      <path d={`M${100 - w * 0.55} 74C${100 - w * 0.6} 110 ${100 - w * 0.2} 140 ${100 - w * 0.05} 164`} stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".25" />
    </g>
  );
}

function Ginger({ p }: { p: Pal }) {
  const knobs: Array<[number, number, number, number]> = [[50, 92, 17, 22], [86, 76, 16, 22], [128, 80, 16, 20], [158, 116, 17, 19], [46, 128, 16, 16]];
  return (
    <g>
      <Shadow rx={64} />
      <g fill={p.d} transform="translate(3 4)">
        <ellipse cx="102" cy="114" rx="62" ry="27" transform="rotate(-8 102 114)" />
        {knobs.map(([x, y, rx, ry]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx={rx} ry={ry} />)}
      </g>
      <g fill={p.m}>
        <ellipse cx="102" cy="114" rx="62" ry="27" transform="rotate(-8 102 114)" />
        {knobs.map(([x, y, rx, ry]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx={rx} ry={ry} />)}
      </g>
      <g fill={p.l} opacity=".9">
        <ellipse cx="50" cy="76" rx="9" ry="6" />
        <ellipse cx="86" cy="60" rx="8" ry="5" />
        <ellipse cx="128" cy="66" rx="8" ry="5" />
      </g>
      <path d="M62 104q8 6 4 16M96 100q6 8 2 18M128 102q7 6 4 16M150 120q-6 4-8 12" stroke={p.d} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".7" />
      <Gloss cx={96} cy={104} rx={26} ry={5} rot={-8} o={0.2} />
    </g>
  );
}

function Lemon({ p }: { p: Pal }) {
  const body = "M30 104C30 104 44 98 52 84C70 56 130 56 148 84C156 98 170 104 170 104C170 104 156 110 148 124C130 152 70 152 52 124C44 110 30 104 30 104Z";
  return (
    <g>
      <Shadow rx={64} cy={170} />
      <g transform="rotate(-16 100 104)">
        <path d={body} fill={p.d} transform="translate(2 4)" />
        <path d={body} fill={p.m} />
        <g fill={p.d} opacity=".28">
          {[[70, 96], [92, 118], [118, 90], [132, 118], [104, 100], [78, 122]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />)}
        </g>
        <Gloss cx={86} cy={84} rx={26} ry={6} rot={-6} o={0.4} />
        <path d="M168 100c10-18 24-22 34-18-4 14-18 22-34 18Z" fill={p.g ?? LEAF} />
      </g>
    </g>
  );
}

function Capsicum({ p }: { p: Pal }) {
  const body = "M52 80C52 62 76 58 100 66C124 58 148 62 148 80C158 110 150 150 124 164C112 170 88 170 76 164C50 150 42 110 52 80Z";
  return (
    <g>
      <Shadow rx={54} />
      <path d={body} fill={p.d} transform="translate(3 3)" />
      <path d={body} fill={p.m} />
      <path d="M100 68C84 100 84 140 100 166M72 74C58 106 66 146 84 164M128 74C142 106 134 146 116 164" stroke={p.d} strokeWidth="2.2" fill="none" opacity=".4" />
      <path d="M100 66C100 52 98 44 106 36" stroke={p.g ?? LEAF_D} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Gloss cx={68} cy={96} rx={8} ry={20} rot={10} o={0.35} />
    </g>
  );
}

function Chilli({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow rx={62} />
      <g strokeLinecap="round" fill="none">
        <path d="M34 152C74 160 130 140 154 78" stroke={p.d} strokeWidth="21" transform="translate(2 5)" />
        <path d="M34 152C74 160 130 140 154 78" stroke={p.m} strokeWidth="19" />
        <path d="M40 150C76 152 122 134 146 80" stroke="#fff" strokeWidth="3" opacity=".3" />
        <path d="M30 118C62 134 112 116 136 54" stroke={p.d} strokeWidth="19" transform="translate(2 5)" />
        <path d="M30 118C62 134 112 116 136 54" stroke={p.m} strokeWidth="17" />
        <path d="M36 114C64 124 108 108 128 58" stroke="#fff" strokeWidth="3" opacity=".3" />
      </g>
      <path d="M150 84c4-12 8-20 16-26M132 62c4-12 8-20 18-26" stroke={LEAF_D} strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="152" cy="82" r="7" fill={LEAF_D} />
      <circle cx="134" cy="60" r="7" fill={LEAF_D} />
    </g>
  );
}

function Cabbage({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow rx={62} />
      <circle cx="102" cy="106" r="64" fill={p.d} />
      <circle cx="100" cy="102" r="61" fill={p.m} />
      <path d="M40 100C44 60 80 40 100 40C122 40 158 62 160 104C140 80 62 78 40 100Z" fill={p.l} opacity=".55" />
      <path d="M44 104C70 84 130 84 156 104M54 74C84 98 118 98 148 72M60 140C90 118 116 118 144 138" stroke={p.d} strokeWidth="2.6" fill="none" opacity=".55" />
      <path d="M100 44V162M100 70L74 98M100 70L126 98M100 112L78 138M100 112L122 138" stroke={p.l} strokeWidth="3" strokeLinecap="round" fill="none" opacity=".75" />
      <Gloss cx={66} cy={70} rx={16} ry={8} rot={-35} o={0.25} />
    </g>
  );
}

function Cauliflower({ p }: { p: Pal }) {
  const heads: Array<[number, number, number]> = [[58, 100, 22], [82, 78, 25], [116, 74, 25], [142, 98, 22], [100, 100, 28], [70, 124, 22], [130, 124, 22], [100, 132, 20]];
  return (
    <g>
      <Shadow rx={62} />
      <path d="M28 120C24 92 44 76 62 90C54 106 62 126 80 140C58 150 34 142 28 120ZM172 120C176 92 156 76 138 90C146 106 138 126 120 140C142 150 166 142 172 120Z" fill={p.g ?? LEAF} />
      <path d="M44 100C50 116 64 128 78 136M156 100C150 116 136 128 122 136" stroke={LEAF_D} strokeWidth="2" fill="none" opacity=".6" />
      <g fill={p.d}>{heads.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x + 2} cy={y + 3} r={r} />)}</g>
      <g fill={p.m}>{heads.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} />)}</g>
      <g fill="#fff" opacity=".45">{heads.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.28} />)}</g>
      <path d="M86 150h28l-4 20H90Z" fill={p.l} />
    </g>
  );
}

function Brinjal({ p }: { p: Pal }) {
  const body = "M72 62C46 72 42 114 60 148C76 176 118 182 140 156C158 134 146 92 134 68C122 54 90 54 72 62Z";
  return (
    <g>
      <Shadow rx={58} />
      <g transform="rotate(-18 100 110)">
        <path d={body} fill={p.d} transform="translate(3 3)" />
        <path d={body} fill={p.m} />
        <path d="M78 84C66 110 68 142 82 164" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".28" />
        <path d="M66 62C78 46 124 46 138 62C130 76 114 80 102 72C90 80 76 76 66 62Z" fill={p.g ?? LEAF} />
        <path d="M96 52C98 36 106 30 112 28" stroke={LEAF_D} strokeWidth="8" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

function Okra({ p }: { p: Pal }) {
  const pod = (x: number, y: number, r: number, s = 1) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M-11 0C-13 34-8 66 0 92C8 66 13 34 11 0Z" fill={p.d} transform="translate(2 2)" />
      <path d="M-11 0C-13 34-8 66 0 92C8 66 13 34 11 0Z" fill={p.m} />
      <path d="M0 6V84M-6 10C-7 38-4 62 0 84M6 10C7 38 4 62 0 84" stroke={p.d} strokeWidth="1.6" fill="none" opacity=".5" />
      <path d="M-13 4C-12-8-5-12 0-12C5-12 12-8 13 4C8 8-8 8-13 4Z" fill={LEAF_D} />
      <rect x="-3" y="-20" width="6" height="12" rx="3" fill={LEAF_D} />
    </g>
  );
  return (
    <g>
      <Shadow rx={56} />
      {pod(62, 54, 18, 1.28)}
      {pod(138, 54, -18, 1.28)}
      {pod(100, 46, 0, 1.4)}
    </g>
  );
}

function BottleGourd({ p }: { p: Pal }) {
  const body = "M82 34C78 34 76 46 77 70C78 96 58 108 56 136C55 162 76 178 102 178C130 178 146 160 144 134C142 108 124 94 123 70C122 46 120 34 116 34C106 30 92 30 82 34Z";
  return (
    <g>
      <Shadow rx={56} />
      <path d={body} fill={p.d} transform="translate(3 3)" />
      <path d={body} fill={p.m} />
      <path d="M72 124C68 148 78 164 94 168" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".35" />
      <g fill={p.l} opacity=".55">{[[96, 100], [124, 140], [104, 150], [86, 128], [118, 112]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" />)}</g>
      <path d="M98 34C98 22 102 16 110 14" stroke={p.d} strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Cucumber({ p, slice }: { p: Pal; slice?: boolean }) {
  return (
    <g>
      <Shadow rx={68} cy={172} />
      <g transform="rotate(-24 100 100)">
        <rect x="26" y="78" width="148" height="46" rx="22" fill={p.d} transform="translate(2 4)" />
        <rect x="26" y="78" width="148" height="46" rx="22" fill={p.m} />
        <path d="M44 92H158M44 102H160M44 112H158" stroke={p.d} strokeWidth="2.4" strokeLinecap="round" opacity=".35" />
        <g fill={p.d} opacity=".5">{[[56, 90], [84, 112], [112, 92], [138, 110], [150, 92], [70, 106]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" />)}</g>
        <Gloss cx={86} cy={87} rx={34} ry={4} rot={0} o={0.3} />
        <rect x="164" y="94" width="12" height="14" rx="4" fill={LEAF_D} />
      </g>
      {slice ? (
        <g>
          <circle cx="146" cy="142" r="26" fill={p.m} />
          <circle cx="146" cy="142" r="22" fill={p.l} />
          <circle cx="146" cy="142" r="12" fill="#e8f3d5" />
          {[[140, 138], [152, 138], [146, 148], [140, 146], [152, 146]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.2" ry="1.4" fill="#fff" opacity=".9" />)}
        </g>
      ) : null}
    </g>
  );
}

function Gourd({ p, ridges }: { p: Pal; ridges: boolean }) {
  const body = ridges ? "M20 128C36 100 100 78 164 74C182 74 184 90 170 98C128 124 60 150 30 144C20 142 16 136 20 128Z" : "M24 124C44 94 112 74 166 82C178 84 180 96 168 102C128 126 66 150 34 138C24 134 20 130 24 124Z";
  return (
    <g>
      <Shadow rx={68} cy={172} />
      <g transform="rotate(-6 100 108)">
        <path d={body} fill={p.d} transform="translate(2 5)" />
        <path d={body} fill={p.m} />
        {ridges ? (
          <path d="M34 128C70 108 120 92 166 84M36 134C76 122 124 106 166 94M42 140C80 134 124 120 160 102" stroke={p.d} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".65" />
        ) : (
          <g>
            <path d="M32 128C70 108 120 92 166 86" stroke={p.d} strokeWidth="1.6" fill="none" opacity=".5" />
            {Array.from({ length: 14 }, (_, i) => {
              const x = 40 + i * 9.4;
              const y = 128 - i * 3.1 + (i % 2) * 7;
              return <ellipse key={i} cx={x} cy={y} rx="3.4" ry="5" fill={p.d} opacity=".55" transform={`rotate(-20 ${x} ${y})`} />;
            })}
          </g>
        )}
        <Gloss cx={96} cy={104} rx={32} ry={4} rot={-12} o={0.26} />
        <path d="M168 84c6-6 14-8 20-6" stroke={LEAF_D} strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

function Pumpkin({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow rx={68} />
      <ellipse cx="102" cy="112" rx="72" ry="56" fill={p.d} />
      <ellipse cx="100" cy="108" rx="70" ry="54" fill={p.m} stroke={p.d} strokeWidth="2" />
      <ellipse cx="100" cy="108" rx="50" ry="54" fill={p.m} stroke={p.d} strokeWidth="2.4" opacity=".95" />
      <ellipse cx="100" cy="108" rx="26" ry="54" fill={p.l} stroke={p.d} strokeWidth="2.4" opacity=".55" />
      <path d="M96 58C94 42 100 34 112 30" stroke={p.g ?? "#6b4a24"} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Gloss cx={56} cy={88} rx={12} ry={7} rot={-30} o={0.25} />
    </g>
  );
}

function Arbi({ p }: { p: Pal }) {
  const corm = (x: number, y: number, s: number) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="2" cy="3" rx="32" ry="40" fill={p.d} />
      <ellipse cx="0" cy="0" rx="31" ry="39" fill={p.m} />
      <path d="M-26 -14q26 8 52 0M-30 2q30 9 60 0M-28 18q28 8 56 0" stroke={p.d} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".6" />
      <path d="M-4 -40q4-8 8 0" stroke={p.d} strokeWidth="5" strokeLinecap="round" fill="none" />
      <Gloss cx={-14} cy={-18} rx={7} ry={14} rot={14} o={0.2} />
    </g>
  );
  return (
    <g>
      <Shadow rx={64} />
      {corm(66, 120, 1)}
      {corm(134, 116, 1)}
      {corm(100, 80, 0.92)}
    </g>
  );
}

function Peas({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow rx={66} cy={174} />
      <path d="M20 96C60 172 142 172 180 96C140 128 60 128 20 96Z" fill={p.d} />
      <path d="M32 99C66 148 136 148 168 99C136 118 64 118 32 99Z" fill={p.l} />
      {[[64, 112], [100, 120], [136, 112]].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="17" fill={p.m} />
          <circle cx={x - 5} cy={y - 6} r="5" fill="#fff" opacity=".35" />
        </g>
      ))}
      <path d="M24 98C14 92 10 84 12 76" stroke={p.d} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="168" cy="62" r="14" fill={p.m} />
      <circle cx="163" cy="57" r="4.5" fill="#fff" opacity=".35" />
      <circle cx="140" cy="48" r="11" fill={p.m} />
      <circle cx="136" cy="44" r="3.5" fill="#fff" opacity=".35" />
    </g>
  );
}

function Beans({ p, thick }: { p: Pal; thick?: boolean }) {
  const w = thick ? 12 : 8;
  const paths = ["M30 164C64 124 110 82 176 58", "M40 176C78 140 124 98 186 76", "M24 140C56 104 100 66 160 44", "M52 180C86 150 134 112 190 96"];
  return (
    <g>
      <Shadow rx={62} cy={178} />
      <g strokeLinecap="round" fill="none">
        {paths.map((d) => <path key={d} d={d} stroke={p.d} strokeWidth={w + 2} transform="translate(2 4)" />)}
        {paths.map((d) => <path key={`m${d}`} d={d} stroke={p.m} strokeWidth={w} />)}
        {paths.map((d) => <path key={`l${d}`} d={d} stroke="#fff" strokeWidth="2" opacity=".28" transform="translate(-1 -2)" />)}
      </g>
      <path d="M92 118l22 22" stroke="#c9a46a" strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

function Drumstick({ p }: { p: Pal }) {
  const sticks = ["M16 174L172 30", "M34 184L188 52", "M10 150L150 22"];
  return (
    <g>
      <Shadow rx={58} cy={180} />
      <g strokeLinecap="round">
        {sticks.map((d) => <path key={d} d={d} stroke={p.d} strokeWidth="10" transform="translate(2 4)" />)}
        {sticks.map((d) => <path key={`m${d}`} d={d} stroke={p.m} strokeWidth="8" />)}
        {sticks.map((d) => <path key={`l${d}`} d={d} stroke={p.l} strokeWidth="2" opacity=".55" strokeDasharray="1 11" />)}
      </g>
      {[[54, 140], [92, 104], [130, 68], [72, 156], [112, 118], [150, 82]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill={p.d} opacity=".75" />)}
    </g>
  );
}

function Mushroom({ p }: { p: Pal }) {
  const one = (x: number, y: number, s: number) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-18 4C-20 34-24 54-30 66L30 66C24 54 20 34 18 4Z" fill={p.l} />
      <path d="M-18 4C-20 34-24 54-30 66L-18 66C-14 50-12 30-12 4Z" fill={p.d} opacity=".2" />
      <path d="M-64 4C-64-44 64-44 64 4C64 16-64 16-64 4Z" fill={p.d} transform="translate(2 3)" />
      <path d="M-64 2C-64-46 64-46 64 2C64 14-64 14-64 2Z" fill={p.m} />
      <ellipse cx="-24" cy="-22" rx="22" ry="7" fill="#fff" opacity=".4" transform="rotate(-16 -24 -22)" />
      <path d="M-62 8C-40 18 40 18 62 8" stroke={p.d} strokeWidth="2" fill="none" opacity=".4" />
    </g>
  );
  return (
    <g>
      <Shadow rx={64} />
      {one(66, 104, 0.78)}
      {one(124, 92, 0.98)}
    </g>
  );
}

function Leafy({ p, leaf }: { p: Pal; leaf: "broad" | "lobed" | "oval" | "round" }) {
  const angles = [-52, -34, -16, 0, 16, 34, 52];
  const shape = {
    broad: "M0 0C-28-18-24-66 0-96C24-66 28-18 0 0Z",
    oval: "M0 0C-20-14-20-48 0-70C20-48 20-14 0 0Z",
    lobed: "M0 0C-20-10-30-30-18-46C-30-56-14-76 0-70C14-76 30-56 18-46C30-30 20-10 0 0Z",
    round: "M0 0C-24-8-30-40-6-54C-26-66-6-88 0-80C6-88 26-66 6-54C30-40 24-8 0 0Z",
  }[leaf];
  const scale = leaf === "broad" ? 1 : leaf === "oval" ? 1.15 : 1.1;
  return (
    <g>
      <Shadow rx={52} cy={178} />
      <g transform="translate(100 150)">
        {angles.map((a, i) => (
          <g key={a} transform={`rotate(${a}) scale(${(0.82 + (i % 3) * 0.1) * scale})`}>
            <path d="M0 0V-26" stroke={p.l} strokeWidth="3.5" strokeLinecap="round" />
            <g transform="translate(0 -22)">
              <path d={shape} fill={i % 2 ? p.m : p.d} />
              <path d="M0 -2V-62" stroke={p.l} strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
            </g>
          </g>
        ))}
      </g>
      <path d="M82 138h36l-3 18H85Z" fill="#d9b47a" />
      <path d="M86 146h28" stroke="#b58b4c" strokeWidth="2" />
      <path d="M90 156v14M100 156v18M110 156v14" stroke={p.l} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function SpringOnion({ p }: { p: Pal }) {
  const blades = [-20, -10, 0, 10, 20];
  return (
    <g>
      <Shadow rx={46} cy={180} />
      <g transform="translate(100 150)">
        {blades.map((a, i) => (
          <path key={a} d="M-5 0C-8-50-6-100 0-136C6-100 8-50 5 0Z" fill={i % 2 ? p.m : p.d} transform={`rotate(${a} 0 20)`} />
        ))}
      </g>
      <g>
        {[-24, -8, 8, 24].map((x) => (
          <g key={x}>
            <ellipse cx={100 + x} cy="158" rx="9" ry="14" fill={p.l} />
            <path d={`M${100 + x} 170v8l${x < 0 ? -3 : 3} 4`} stroke="#9aa89f" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        ))}
      </g>
      <rect x="78" y="136" width="44" height="7" rx="3.5" fill="#d9b47a" />
    </g>
  );
}

function Generic({ p }: { p: Pal }) {
  return (
    <g>
      <Shadow />
      <circle cx="102" cy="108" r="58" fill={p.d} />
      <circle cx="100" cy="104" r="56" fill={p.m} />
      <Gloss cx={74} cy={82} rx={16} ry={9} />
      <path d="M100 50C100 38 104 32 112 28" stroke={LEAF_D} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M108 40c10-14 26-14 34-8-6 12-20 16-34 8Z" fill={LEAF} />
    </g>
  );
}

/** keyword in the product slug → shape and colours. Specific names come before general ones ("sweet-potato" before "potato"). */
const ART: Array<[string, Kind, Pal, { leaf?: "broad" | "lobed" | "oval" | "round"; thick?: boolean; slice?: boolean; half?: number; leaves?: boolean }?]> = [
  ["tomato", "tomato", { m: "#e5392b", d: "#b3261b", l: "#ff8a78" }],
  ["sweet-potato", "sweetpotato", { m: "#c4694a", d: "#8f3f2b", l: "#e6a584", t: "#e6a584" }],
  ["potato", "potato", { m: "#d2a46a", d: "#9c7240", l: "#ead0a4" }],
  ["spring-onion", "springonion", { m: "#3fa34d", d: "#2a7f3a", l: "#f4f7ec", t: "#8cc98f" }],
  ["onion", "onion", { m: "#c0568c", d: "#8f3566", l: "#e9a8c8" }],
  ["beetroot", "beet", { m: "#a8174a", d: "#7a0f35", l: "#d65b8a", g: "#3d9a4a" }],
  ["carrot", "carrot", { m: "#f08a1c", d: "#c4620a", l: "#ffbf6b", g: "#3d9a4a" }, { half: 27, leaves: true }],
  ["radish", "radish", { m: "#f6eef4", d: "#cdb7c9", l: "#ffffff", g: "#3d9a4a", t: "#c9a3c0" }, { half: 31, leaves: true }],
  ["ginger", "ginger", { m: "#d7ab68", d: "#a67c3c", l: "#f1d6a2" }],
  ["garlic", "garlic", { m: "#f7f1e6", d: "#c9bda6", l: "#e9c3d4", t: "#cdbb98" }],
  ["lemon", "lemon", { m: "#f5d416", d: "#c9a30a", l: "#fff08a", g: "#3d9a4a" }],
  ["capsicum", "capsicum", { m: "#3fae49", d: "#2a8035", l: "#9be0a2", g: "#1f6b33" }],
  ["chilli", "chilli", { m: "#2f9a3c", d: "#1f7029", l: "#8fdc98" }],
  ["cabbage", "cabbage", { m: "#8cc973", d: "#5e9d4a", l: "#e5f5da" }],
  ["cauliflower", "cauliflower", { m: "#f6f0d8", d: "#d3c797", l: "#fffbe8", g: "#4ea65a", t: "#cdbf7e" }],
  ["brinjal", "brinjal", { m: "#6a3d94", d: "#3f2260", l: "#b58be0", g: "#3d9a4a" }],
  ["ladyfinger", "okra", { m: "#59a63e", d: "#3b7a28", l: "#a6dd8f" }],
  ["bhindi", "okra", { m: "#59a63e", d: "#3b7a28", l: "#a6dd8f" }],
  ["bottle-gourd", "bottlegourd", { m: "#a8d27a", d: "#78a84a", l: "#e0f1c8" }],
  ["lauki", "bottlegourd", { m: "#a8d27a", d: "#78a84a", l: "#e0f1c8" }],
  ["kakdi", "cucumber", { m: "#9cc86a", d: "#6c9a3e", l: "#e6f2cf" }, { slice: true }],
  ["cucumber", "cucumber", { m: "#4c9f49", d: "#2f7230", l: "#c9e9b3" }, { slice: true }],
  ["bitter-gourd", "bittergourd", { m: "#3e8f3d", d: "#2a6a2a", l: "#9bd495" }],
  ["ridge-gourd", "ridgegourd", { m: "#78b45a", d: "#4c8a38", l: "#c4e6ad" }],
  ["pumpkin", "pumpkin", { m: "#ec9a2c", d: "#bd6c10", l: "#ffc874", g: "#6b4a24" }],
  ["arbi", "arbi", { m: "#a58b66", d: "#725c3c", l: "#d6c3a1" }],
  ["colocasia", "arbi", { m: "#a58b66", d: "#725c3c", l: "#d6c3a1" }],
  ["peas", "peas", { m: "#68b84b", d: "#3f8a2b", l: "#c8eaa8" }],
  ["french-beans", "beans", { m: "#4fa24a", d: "#327a30", l: "#a2dc9a" }],
  ["cluster-beans", "beans", { m: "#76ad4c", d: "#4c8030", l: "#bfe29a" }, { thick: true }],
  ["drumstick", "drumstick", { m: "#6e9b45", d: "#486f2a", l: "#c3dd9f" }],
  ["mushroom", "mushroom", { m: "#e6d6bd", d: "#b79d78", l: "#f6efe2", t: "#c4a77a" }],
  ["spinach", "leafy", { m: "#2f8f46", d: "#1f6b33", l: "#8fd39b" }, { leaf: "broad" }],
  ["palak", "leafy", { m: "#2f8f46", d: "#1f6b33", l: "#8fd39b" }, { leaf: "broad" }],
  ["fenugreek", "leafy", { m: "#4aa85a", d: "#2c7e3c", l: "#a4dfae" }, { leaf: "round" }],
  ["methi", "leafy", { m: "#4aa85a", d: "#2c7e3c", l: "#a4dfae" }, { leaf: "round" }],
  ["mint", "leafy", { m: "#33a36c", d: "#1f7a4d", l: "#9be0be" }, { leaf: "oval" }],
  ["pudina", "leafy", { m: "#33a36c", d: "#1f7a4d", l: "#9be0be" }, { leaf: "oval" }],
  ["coriander", "leafy", { m: "#4cae52", d: "#2d8236", l: "#a9e0ad" }, { leaf: "lobed" }],
  ["dhaniya", "leafy", { m: "#4cae52", d: "#2d8236", l: "#a9e0ad" }, { leaf: "lobed" }],
];

const FALLBACK: Pal = { m: "#6fae5a", d: "#4a8a3a", l: "#bde3ae" };

export interface ArtChoice {
  kind: Kind;
  pal: Pal;
  opt: NonNullable<(typeof ART)[number][3]>;
}

export function artFor(slug: string): ArtChoice {
  const hit = ART.find(([k]) => slug.includes(k));
  return hit ? { kind: hit[1], pal: hit[2], opt: hit[3] ?? {} } : { kind: "generic", pal: FALLBACK, opt: {} };
}

/** Soft tile background for a product: a wash of its own colour over the card surface. */
export function artTint(slug: string): string {
  const { pal } = artFor(slug);
  return `color-mix(in srgb, ${pal.t ?? pal.m} 20%, var(--surface))`;
}

/** The drawing alone, as SVG children, so banners can place several at different sizes. */
export function ArtShape({ slug }: { slug: string }): ReactNode {
  const { kind, pal: p, opt } = artFor(slug);
  switch (kind) {
    case "tomato": return <Tomato p={p} />;
    case "onion": return <Onion p={p} />;
    case "garlic": return <Garlic p={p} />;
    case "potato": return <Potato p={p} />;
    case "sweetpotato": return <SweetPotato p={p} />;
    case "beet": return <Beet p={p} />;
    case "carrot": return <Taper p={p} half={opt.half ?? 27} leaves />;
    case "radish": return <Taper p={p} half={opt.half ?? 25} tip={192} leaves />;
    case "ginger": return <Ginger p={p} />;
    case "lemon": return <Lemon p={p} />;
    case "capsicum": return <Capsicum p={p} />;
    case "chilli": return <Chilli p={p} />;
    case "cabbage": return <Cabbage p={p} />;
    case "cauliflower": return <Cauliflower p={p} />;
    case "brinjal": return <Brinjal p={p} />;
    case "okra": return <Okra p={p} />;
    case "bottlegourd": return <BottleGourd p={p} />;
    case "cucumber": return <Cucumber p={p} slice={opt.slice} />;
    case "bittergourd": return <Gourd p={p} ridges={false} />;
    case "ridgegourd": return <Gourd p={p} ridges />;
    case "pumpkin": return <Pumpkin p={p} />;
    case "arbi": return <Arbi p={p} />;
    case "peas": return <Peas p={p} />;
    case "beans": return <Beans p={p} thick={opt.thick} />;
    case "drumstick": return <Drumstick p={p} />;
    case "mushroom": return <Mushroom p={p} />;
    case "leafy": return <Leafy p={p} leaf={opt.leaf ?? "broad"} />;
    case "springonion": return <SpringOnion p={p} />;
    default: return <Generic p={p} />;
  }
}

export function ProductArt({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg viewBox="10 12 180 176" aria-hidden focusable="false" className={className}>
      <ArtShape slug={slug} />
    </svg>
  );
}
