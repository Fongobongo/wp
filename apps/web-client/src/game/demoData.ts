export type DemoUnit = {
  id: string;
  name: string;
  team: "Blue" | "Red";
  role: "Assault" | "Defender" | "Ranger" | "Mage" | "Healer";
  hp: number;
  attack: number;
  move: number;
  q: number;
  r: number;
  color: number;
};

export const DEMO_UNITS: DemoUnit[] = [
  {
    id: "u-vanguard",
    name: "Vanguard",
    team: "Blue",
    role: "Assault",
    hp: 130,
    attack: 28,
    move: 3,
    q: 0,
    r: 0,
    color: 0xff6b35
  }
];
