export const isJokerKilling = (
  cards: number | number[],
  c_cards: number | number[],
) => {
  if (typeof cards === 'object' && typeof c_cards === 'object') {
    return (
      ((cards.includes(14) && c_cards.includes(1)) ||
        (cards.includes(1) && c_cards.includes(14))) &&
      !(
        cards.includes(14) &&
        !c_cards.includes(1) &&
        cards.includes(1) &&
        !c_cards.includes(14)
      )
    );
  } else {
    return (cards === 14 && c_cards === 1) || (cards === 1 && c_cards === 14);
  }
};
