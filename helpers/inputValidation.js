export const INPUT_LIMITS = {
  name: 100,
  email: 254,
  password: 128,
  phone: 30,
  address: 500,
  answer: 200,
  categoryName: 100,
  searchKeyword: 100,
};

export const isTextString = (value) => typeof value === "string";

export const exceedsMaxLength = (value, maxLength) =>
  typeof value === "string" && value.length > maxLength;
