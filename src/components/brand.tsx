import Svg, { Defs, LinearGradient, Stop, Path, Rect, G } from "react-native-svg";

export function BrandSymbol({ width = 82, height = 52, mono = false }: { width?: number; height?: number; mono?: boolean }) {
  const orange = mono ? "#FFF3E7" : "#FF951E";
  return <Svg width={width} height={height} viewBox="0 0 158 100" accessibilityLabel="Símbolo HiperSales">
    <Path fill={orange} d="M5 15H43C50 15 55 18 60 24L82 51C86 56 89 57 96 57H104C111 57 115 63 115 71V78C115 91 103 96 88 97V69C88 65 86 63 82 63H70C61 63 56 60 51 54L5 15Z"/>
    <Path fill={orange} d="M65 17H103C112 17 118 22 124 30L146 57C149 61 153 62 155 62V82C155 91 147 97 133 98V69C133 65 131 63 127 63H119C110 63 106 60 100 53L65 17Z"/>
  </Svg>;
}

export function LoginWallpaper() {
  return <Svg style={{ position: "absolute", width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice" viewBox="0 0 430 900">
    <Defs><LinearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#034044"/><Stop offset="0.5" stopColor="#052528"/><Stop offset="1" stopColor="#00191C"/></LinearGradient></Defs>
    <Rect width="430" height="900" fill="url(#wall)"/>
    <G fill="none" stroke="#FF951E" strokeWidth="0.85" opacity="0.50">
      <Path d="M-120 30H105Q130 30 151 53L324 261Q340 279 367 279H470"/>
      <Path d="M-15 -52L196 190Q207 201 229 201H329Q357 201 375 226L530 409"/>
      <Path d="M-78 312L65 487Q84 510 112 510H295Q326 510 347 535L491 705"/>
      <Path d="M-71 563H56Q86 563 104 584L272 790Q287 809 310 809H500"/>
      <Path d="M-36 761H139Q162 761 181 781L290 914"/>
      <Path d="M-90 220H-2Q21 220 37 240L150 377Q163 393 191 393H342Q372 393 372 425V468"/>
    </G>
  </Svg>;
}
