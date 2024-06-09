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
    case 'jk':
      return 14;
    case '11':
    case '１１':
    case 'j':
    case 'jack':
      return 11;
    case '12':
    case '１２':
    case 'q':
    case 'queen':
      return 12;
    case '13':
    case '１３':
    case 'k':
    case 'king':
      return 13;
    case '1':
    case '１':
    case 'a':
    case 'ace':
      return 1;
    default:
      const num = Number(value);
      return isNaN(num) ? -1 : num;
  }
};
