export const convertCardValue = (input: string) => {
  const value = input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    );

  switch (value) {
    case 'joker':
    case 'Joker':
    case 'j':
    case 'J':
      return 14;
    case '11':
    case '１１':
    case 'jack':
    case 'Jack':
      return 11;
    case '12':
    case '１２':
    case 'q':
    case 'Q':
    case 'queen':
    case 'Queen':
      return 12;
    case '13':
    case '１３':
    case 'k':
    case 'K':
    case 'king':
    case 'King':
      return 13;
    case '1':
    case '１':
    case 'a':
    case 'A':
    case 'ace':
    case 'Ace':
      return 1;
    default:
      const num = Number(value);
      return isNaN(num) ? -1 : num;
  }
};
