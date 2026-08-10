const fs = require("fs");

const firstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Ananya", "Diya", "Saanvi", "Aadhya", "Pari", "Riya",
  "Anika", "Navya", "Kiara", "Myra", "Kabir", "Dhruv", "Aryan", "Rahul",
  "Priya", "Neha", "Karan", "Tara", "Zara", "Sneha"
];

const lastNames = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Mehta", "Gupta",
  "Singh", "Kumar", "Debnath", "Das", "Bose", "Rao", "Joshi", "Kapoor",
  "Malhotra", "Chopra", "Banerjee", "Mukherjee", "Pillai", "Menon", "Shetty",
  "Pawar", "Deshmukh", "Bhat", "Agarwal", "Saxena", "Trivedi", "Naidu"
];

const rows = [["Name", "Email"]];
for (let i = 0; i < 30; i++) {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3 + 1) % lastNames.length];
  const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i + 10}@gmail.com`;
  rows.push([`${fn} ${ln}`, email]);
}

// CSV
const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
fs.writeFileSync("test-staff-30.csv", csv);

// JSON
const json = rows.slice(1).map((r) => ({ name: r[0], email: r[1] }));
fs.writeFileSync("test-staff-30.json", JSON.stringify(json, null, 2));

console.log("Generated test-staff-30.csv + test-staff-30.json (30 staff)");
