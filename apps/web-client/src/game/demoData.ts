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
    q: 1,
    r: 2,
    color: 0xff6b35
  },
  {
    id: "u-bastion",
    name: "Bastion",
    team: "Blue",
    role: "Defender",
    hp: 175,
    attack: 16,
    move: 2,
    q: 1,
    r: 4,
    color: 0x4c8bf5
  },
  {
    id: "u-ranger",
    name: "Longshot",
    team: "Blue",
    role: "Ranger",
    hp: 102,
    attack: 25,
    move: 3,
    q: 2,
    r: 1,
    color: 0x2ecc71
  },
  {
    id: "u-arcanist",
    name: "Arcanist",
    team: "Red",
    role: "Mage",
    hp: 95,
    attack: 31,
    move: 2,
    q: 2,
    r: 3,
    color: 0xa66cff
  },
  {
    id: "u-medic",
    name: "Medic",
    team: "Red",
    role: "Healer",
    hp: 108,
    attack: 14,
    move: 2,
    q: 0,
    r: 3,
    color: 0xf1c40f
  }
];
