export const foodDishes = ["Ugali", "Wali", "Pilau", "Chips", "Ndizi"];
export const fruitsDishes = ["Fruits"];
export const juiceDishes = ["Juice (Mix/Mango/Passion)", "Juice (Dates)"];

export const mainDishes = [...foodDishes, ...fruitsDishes, ...juiceDishes];

export const validSidesMap: Record<string, string[]> = {
  Ugali: ["Utumbo wa Mbogamboga", "Kuku Robo", "Nyama Choma (Ng'ombe)"],
  Wali: ["Maini", "Nyama"],
  Chips: ["Kuku Robo", "Mayai", "Mishkaki (Vipande 3)"],
  Ndizi: ["Nyama"],
  "Juice (Mix/Mango/Passion)": ["Cashewnuts", "Groundnuts"],
};

export const standaloneItems = new Set([
  "Pilau",
  "Fruits",
  "Juice (Mix/Mango/Passion)",
  "Juice (Dates)",
]);

export const optionalSideItems = new Set(["Juice (Mix/Mango/Passion)"]);

export const getPriceForItem = (item: string): number => {
  if (item === "Pilau") return 5000;
  if (item === "Juice (Dates)") return 5000;
  if (item === "Juice (Mix/Mango/Passion)") return 3000;
  if (item === "Fruits") return 3000;

  if (item.includes("+")) {
    if (item.includes("Juice") && item.includes("Cashewnuts")) return 5000;
    if (item.includes("Juice") && item.includes("Groundnuts")) return 4000;
    if (item.includes("Chips") && item.includes("Mayai")) return 3000;
    if (item.includes("Chips") && item.includes("Mishkaki")) return 5000;
    return 5000;
  }

  return 0;
};

const foodMains = ["Ugali", "Wali", "Chips", "Ndizi"];

export const foodCombos: string[] = [];
for (const main of foodMains) {
  const sides = validSidesMap[main];
  if (sides) {
    for (const side of sides) {
      foodCombos.push(`${main} + ${side}`);
    }
  }
}

export const getOrderOfTheDay = (): string => {
  if (foodCombos.length === 0) return "Pilau";
  const dayOfMonth = new Date().getDate();
  return foodCombos[dayOfMonth % foodCombos.length];
};

export const DELIVERY_FEE = 0;

export const paymentConfig = {
  food: {
    name: "Bestina Meto",
    phone: "",
    paymentNumber: "1328660",
    paymentType: "Withdrawal to MPESA",
  },
  extras: {
    name: "JUICE ASILI",
    phone: "",
    paymentNumber: "6103 1001",
    paymentType: "Selcom Lipa (*150*50*1#)",
  },
};

export const isExtrasItem = (item: string): boolean => {
  return item.includes("Juice") || item === "Fruits";
};
