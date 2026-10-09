// CER Lab Report (Claudia's Phase 2 writing machines, Build Queue 2026-10-09): a scientific
// explanation in three linked machines. The Claim Cannon fires the answer to the question, the
// Evidence Conveyor carries a data card (a number and a unit), and the Reasoning Bridge connects them
// ("This shows that ... because ..."). Each experiment lists its claims, data and reasons with the
// right one first. No em dashes in any of this text.

export interface CerRow { label: string; value: number; unit: string; text: string }
export interface CerLab {
  id: string; icon: string; question: string; setup: string;
  rows: CerRow[]; best: number; // the data row that proves the claim best
  claims: string[]; reasons: string[]; units: string[]; // units: the right unit first, then wrong ones
}

export const CER_LABS: CerLab[] = [
  { id: 'ramp', icon: '🛝', question: 'Does a higher ramp make a marble roll farther?', setup: 'We rolled a marble down a ramp at three heights and measured how far it rolled.',
    rows: [{ label: '10 cm ramp', value: 45, unit: 'cm', text: 'From the 10 cm ramp, the marble rolled 45 cm.' }, { label: '20 cm ramp', value: 90, unit: 'cm', text: 'From the 20 cm ramp, the marble rolled 90 cm.' }, { label: '30 cm ramp', value: 140, unit: 'cm', text: 'From the 30 cm ramp, the marble rolled 140 cm.' }], best: 2,
    claims: ['A higher ramp makes the marble roll farther.', 'Ramp height does not change how far the marble rolls.', 'A lower ramp makes the marble roll farther.'],
    reasons: ['a higher ramp gives the marble more energy, so it goes faster', 'marbles like tall ramps', 'the marble is heavier on a tall ramp'], units: ['cm', 'kg', 'minutes'] },
  { id: 'magnet', icon: '🧲', question: 'Which magnet is the strongest?', setup: 'We counted how many paper clips each magnet could pick up.',
    rows: [{ label: 'Magnet A', value: 12, unit: 'paper clips', text: 'Magnet A picked up 12 paper clips.' }, { label: 'Magnet B', value: 4, unit: 'paper clips', text: 'Magnet B picked up 4 paper clips.' }, { label: 'Magnet C', value: 7, unit: 'paper clips', text: 'Magnet C picked up 7 paper clips.' }], best: 0,
    claims: ['Magnet A is the strongest.', 'Magnet B is the strongest.', 'All the magnets are the same.'],
    reasons: ['a stronger magnet can hold more paper clips', 'Magnet A is the biggest letter', 'paper clips are made of plastic'], units: ['paper clips', 'liters', 'degrees'] },
  { id: 'plant', icon: '🌱', question: 'Do plants need sunlight to grow?', setup: 'We grew one bean plant by a sunny window and one in a dark closet for 2 weeks.',
    rows: [{ label: 'Sunny window', value: 12, unit: 'cm', text: 'The plant by the sunny window grew 12 cm.' }, { label: 'Dark closet', value: 3, unit: 'cm', text: 'The plant in the dark closet grew only 3 cm.' }], best: 0,
    claims: ['Plants need sunlight to grow well.', 'Plants grow better in the dark.', 'Light does not matter to plants.'],
    reasons: ['plants use sunlight to make their food', 'closets are too small', 'plants are afraid of the dark'], units: ['cm', 'grams', 'seconds'] },
  { id: 'ice', icon: '🧊', question: 'Where does ice melt the fastest?', setup: 'We put the same ice cubes in three places and timed how long they took to melt.',
    rows: [{ label: 'In the sun', value: 10, unit: 'minutes', text: 'The ice cube in the sun melted in 10 minutes.' }, { label: 'In the shade', value: 25, unit: 'minutes', text: 'The ice cube in the shade melted in 25 minutes.' }, { label: 'In the fridge', value: 90, unit: 'minutes', text: 'The ice cube in the fridge took 90 minutes to melt.' }], best: 0,
    claims: ['Ice melts fastest in the sun.', 'Ice melts fastest in the fridge.', 'Ice melts at the same speed everywhere.'],
    reasons: ['the sun gives the ice the most heat energy', 'the sun is very far away', 'fridges are brighter than the sun'], units: ['minutes', 'cm', 'paper clips'] },
  { id: 'towel', icon: '🧻', question: 'Which paper towel soaks up the most water?', setup: 'We dipped three brands of paper towel in water and measured how much each soaked up.',
    rows: [{ label: 'Brand A', value: 25, unit: 'mL', text: 'Brand A soaked up 25 mL of water.' }, { label: 'Brand B', value: 40, unit: 'mL', text: 'Brand B soaked up 40 mL of water.' }, { label: 'Brand C', value: 15, unit: 'mL', text: 'Brand C soaked up 15 mL of water.' }], best: 1,
    claims: ['Brand B soaks up the most water.', 'Brand C soaks up the most water.', 'All the brands soak up the same amount.'],
    reasons: ['the towel that holds the most water is the most absorbent', 'Brand B has the nicest color', 'water likes the letter B'], units: ['mL', 'cm', 'minutes'] },
  { id: 'bounce', icon: '🎾', question: 'Which ball bounces the highest?', setup: 'We dropped three balls from 1 meter and measured how high each bounced.',
    rows: [{ label: 'Tennis ball', value: 60, unit: 'cm', text: 'The tennis ball bounced 60 cm high.' }, { label: 'Rubber ball', value: 90, unit: 'cm', text: 'The rubber ball bounced 90 cm high.' }, { label: 'Clay ball', value: 0, unit: 'cm', text: 'The clay ball did not bounce at all: 0 cm.' }], best: 1,
    claims: ['The rubber ball bounces the highest.', 'The clay ball bounces the highest.', 'All the balls bounce the same.'],
    reasons: ['rubber springs back into shape and pushes off the floor', 'the rubber ball is the prettiest', 'clay balls are too sleepy'], units: ['cm', 'mL', 'paper clips'] },
];
