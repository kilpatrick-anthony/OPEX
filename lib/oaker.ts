export type OakerMode = 'experience' | 'express';
export type OakerAnswer = 'yes' | 'no' | 'capex';
export type OakerRating = 'Green' | 'Amber' | 'Red';

export type OakerQuestion = {
  id: number;
  section: 'Operations' | 'Customer Service' | 'Systems' | 'Health & Safety';
  standard: string;
  weighting: number;
};

export type OakerQuestionStats = {
  questionId: number;
  failureCount: number;
  storeFailureCount: number;
  recentFailureCount: number;
};

export const OAKER_SECTIONS = ['Operations', 'Customer Service', 'Systems', 'Health & Safety'] as const;

export const OAKER_EXPRESS_DESCRIPTION =
  'OAKER Express is an adaptive store self-check. It prioritises the highest-weighted standards, questions most commonly missed across the estate, store-specific weak spots, recent failed items, and a small rotating sample so teams get a fast, relevant sense check without the full inspection load.';

export const OAKER_QUESTIONS: OakerQuestion[] = [
  { id: 1, section: 'Operations', weighting: 6, standard: 'Merch stand / area in front of till where OAKBARs are is dust free, clean, and well stocked.' },
  { id: 2, section: 'Operations', weighting: 7, standard: 'Customer service waiting area is clean, tidy and undamaged. Floor is clean, dry and free of obstacles, tables and chairs are sanitised, and bin areas are clean and not overflowing.' },
  { id: 3, section: 'Operations', weighting: 6, standard: 'All lighting is working and switched on, including the LED Macaw strip.' },
  { id: 4, section: 'Operations', weighting: 6, standard: 'Equipment, cupboards, and utensils used in the storage and preparation of food are clean and clear of clutter.' },
  { id: 5, section: 'Operations', weighting: 6, standard: 'Till / kiosk equipment and areas are clean, fully functional, and stocked with receipt roll.' },
  { id: 6, section: 'Operations', weighting: 6, standard: "All posters, signage, menu boards, SELs, mirrors, TVs and POS are in good condition and showing the correct updated designs." },
  { id: 7, section: 'Operations', weighting: 6, standard: 'Cobwebs and dust are not present in hard to reach areas. Walls, doors, windows, fixtures, fittings, glass and barriers are clean and in good condition.' },
  { id: 8, section: 'Operations', weighting: 7, standard: 'Fruit is fresh and suitable for serving.' },
  { id: 9, section: 'Operations', weighting: 7, standard: 'Team is communicating and supporting each other, redeploying to reduce queues, managing breaks, and staying productive when not serving customers.' },
  { id: 10, section: 'Operations', weighting: 7, standard: 'Fruit, chopping boards, knives and the general prep area are cleaned regularly. Equipment is cleaned after use.' },
  { id: 11, section: 'Operations', weighting: 6, standard: 'Counter tops are undamaged, clean, uncluttered and clear of litter. Straws, napkins, cups and lids are clean and well stocked.' },
  { id: 12, section: 'Operations', weighting: 6, standard: 'Legal and company notices are displayed clearly and prominently, including CCTV and tipping policy notices.' },
  { id: 13, section: 'Operations', weighting: 6, standard: 'Counterfeit cash checking devices or tools are available to staff and being actively used.' },
  { id: 14, section: 'Operations', weighting: 7, standard: 'All colleagues are wearing brand standard uniform while on duty and personal items are not visible in the lobby.' },
  { id: 15, section: 'Operations', weighting: 7, standard: 'Stock is at the correct level, waste is controlled, stock is stored cleanly, and correct approved products are being used.' },
  { id: 16, section: 'Operations', weighting: 7, standard: 'Comms boards are completed and up to date. Teams are engaged with the OAKER Experience program and it is cultural within the store.' },
  { id: 17, section: 'Operations', weighting: 7, standard: 'Toppings counter has date dots in place, follows the planogram, and is clean and clear of flies.' },
  { id: 18, section: 'Customer Service', weighting: 9, standard: 'Pour a test cup of acai to check taste, consistency, and quality being served to customers.' },
  { id: 19, section: 'Customer Service', weighting: 9, standard: 'Spot check a bowl being served to a customer during this OAKER Experience visit and ensure it meets brand standards.' },
  { id: 20, section: 'Customer Service', weighting: 9, standard: 'Staff are knowledgeable about allergens, know where the information is, and can explain it clearly to customers.' },
  { id: 21, section: 'Customer Service', weighting: 9, standard: 'Fruit is up to a high standard and any supplier issue has been reported.' },
  { id: 22, section: 'Customer Service', weighting: 9, standard: 'Staff welcome all customers, acknowledge queues, and engage with customers at every available opportunity.' },
  { id: 23, section: 'Customer Service', weighting: 9, standard: 'Loyalty Club is mentioned to customers and staff are actively upselling where appropriate.' },
  { id: 24, section: 'Customer Service', weighting: 9, standard: 'Leadership team is visible, actively orchestrating the floor, and confident in shift control.' },
  { id: 25, section: 'Customer Service', weighting: 9, standard: 'Bowls are delivered in an appropriate timeframe and customers are prioritised over tasks.' },
  { id: 26, section: 'Customer Service', weighting: 8, standard: 'Appropriate music is playing, sound is not distorted or too loud, and explicit content controls are active.' },
  { id: 27, section: 'Customer Service', weighting: 9, standard: 'Overnight oats are prepared correctly and presented well.' },
  { id: 28, section: 'Customer Service', weighting: 9, standard: 'Matcha, pitaya, and ube are prepared correctly for taste and colour.' },
  { id: 29, section: 'Customer Service', weighting: 9, standard: 'Chia pudding is prepared correctly for consistency, colour, and taste.' },
  { id: 30, section: 'Customer Service', weighting: 9, standard: 'Coffee and matcha drinks are prepared correctly, including syrup, assets, and milk.' },
  { id: 31, section: 'Customer Service', weighting: 8, standard: 'All toppings are refilled and the deli area is clean.' },
  { id: 32, section: 'Customer Service', weighting: 9, standard: 'Staff can clearly explain the menu and what acai is.' },
  { id: 33, section: 'Customer Service', weighting: 8, standard: 'Customers are thanked and invited to return.' },
  { id: 34, section: 'Customer Service', weighting: 9, standard: 'Google and Toast customer feedback ratings are positive.' },
  { id: 35, section: 'Systems', weighting: 6, standard: 'Weekly or monthly stock count is completed.' },
  { id: 36, section: 'Systems', weighting: 5, standard: 'Product orders are requested and entered into NORY.' },
  { id: 37, section: 'Systems', weighting: 6, standard: 'Staff are clocking in and out correctly.' },
  { id: 38, section: 'Systems', weighting: 5, standard: 'There are no open orders on Toast requiring attention.' },
  { id: 39, section: 'Systems', weighting: 6, standard: 'Waste is being logged correctly in NORY or Toast.' },
  { id: 40, section: 'Systems', weighting: 6, standard: 'The logbook is fully completed and up to date.' },
  { id: 41, section: 'Systems', weighting: 5, standard: 'The Operational Matrix is completed and current.' },
  { id: 42, section: 'Systems', weighting: 5, standard: 'The Manager Sheet is updated, including labour cost and budget information.' },
  { id: 43, section: 'Systems', weighting: 5, standard: 'Warehouse orders are placed on the correct dates and in NORY.' },
  { id: 44, section: 'Systems', weighting: 5, standard: 'Emails are checked and responded to.' },
  { id: 45, section: 'Systems', weighting: 5, standard: 'Acai count emails are being sent.' },
  { id: 46, section: 'Systems', weighting: 6, standard: 'Daily, weekly, and monthly cleaning records are completed.' },
  { id: 47, section: 'Health & Safety', weighting: 11, standard: 'All products on sale and in the stock room are in date and labelled.' },
  { id: 48, section: 'Health & Safety', weighting: 10, standard: 'Hand washing is taking place regularly, sinks are clearly marked and stocked, and gloves are being changed regularly.' },
  { id: 49, section: 'Health & Safety', weighting: 11, standard: 'Temperature checks, corrective actions, traceability, and defrosting processes are completed correctly.' },
  { id: 50, section: 'Health & Safety', weighting: 10, standard: 'Ice machines, ice wells, ice bins and ice handling equipment are clean and sanitised.' },
  { id: 51, section: 'Health & Safety', weighting: 10, standard: 'Fridges, freezers, acai machines, coffee machine, microwave and related equipment are clean and in good working order.' },
  { id: 52, section: 'Health & Safety', weighting: 10, standard: 'Store rooms, prep rooms, offices and break areas are clean, organised and well maintained.' },
  { id: 53, section: 'Health & Safety', weighting: 10, standard: 'Bottles and containers are labelled clearly and correctly, with old labels removed.' },
  { id: 54, section: 'Health & Safety', weighting: 10, standard: 'Acai is defrosted according to procedure and fridges or freezers are defrosted and cleaned regularly.' },
  { id: 55, section: 'Health & Safety', weighting: 11, standard: 'Allergen information is up to date, signage is in place, and staff documents and training records are accessible.' },
  { id: 56, section: 'Health & Safety', weighting: 10, standard: 'Fire extinguishers are in date and correctly placed. Fire exits are clear, marked, and accessible.' },
  { id: 57, section: 'Health & Safety', weighting: 10, standard: 'Sinks and surrounding areas are clean and uncluttered. Cleaning tools, kitchen and prep areas are in good condition.' },
  { id: 58, section: 'Health & Safety', weighting: 11, standard: 'Machines and equipment are clean and free of manufacturers plastic to prevent contamination.' },
  { id: 59, section: 'Health & Safety', weighting: 10, standard: 'Kitchen hazards are identified and controlled for customers, staff, and food safety.' },
  { id: 60, section: 'Health & Safety', weighting: 10, standard: 'First aid kits are stocked, accessible, and complete.' },
  { id: 61, section: 'Health & Safety', weighting: 10, standard: 'Pest control measures are in place, documentation is current, and there is no evidence of pest activity.' },
  { id: 62, section: 'Health & Safety', weighting: 10, standard: 'Customers cannot access non-public areas or chemicals, and chemicals are stored and used separately from food.' },
  { id: 63, section: 'Health & Safety', weighting: 11, standard: 'Colour-coded cloths and cutting boards are used correctly and cross-contamination is prevented.' },
];

export function calculateOakerRating(percentage: number): OakerRating {
  if (percentage >= 90) return 'Green';
  if (percentage >= 75) return 'Amber';
  return 'Red';
}

export function getOakerQuestions(mode: OakerMode, stats: OakerQuestionStats[] = []): OakerQuestion[] {
  if (mode === 'experience') return OAKER_QUESTIONS;

  const byId = new Map(stats.map((item) => [item.questionId, item]));
  const scored = OAKER_QUESTIONS.map((question) => {
    const stat = byId.get(question.id);
    return {
      question,
      score:
        question.weighting * 5 +
        (stat?.storeFailureCount ?? 0) * 8 +
        (stat?.recentFailureCount ?? 0) * 10 +
        (stat?.failureCount ?? 0) * 4,
    };
  });

  const selected = new Map<number, OakerQuestion>();

  scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .forEach((item) => selected.set(item.question.id, item.question));

  OAKER_QUESTIONS
    .filter((question) => question.weighting >= 10)
    .slice(0, 6)
    .forEach((question) => selected.set(question.id, question));

  const daySeed = Math.floor(Date.now() / 86400000);
  OAKER_QUESTIONS
    .slice()
    .sort((a, b) => ((a.id * 37 + daySeed) % 63) - ((b.id * 37 + daySeed) % 63))
    .forEach((question) => {
      if (selected.size < 15) selected.set(question.id, question);
    });

  return Array.from(selected.values())
    .sort((a, b) => a.section.localeCompare(b.section) || a.id - b.id)
    .slice(0, 15);
}

export function scoreOakerResponses(responses: Array<{ questionId: number; answer: OakerAnswer }>) {
  const byQuestion = new Map(OAKER_QUESTIONS.map((question) => [question.id, question]));
  const score = responses.reduce((sum, response) => {
    const question = byQuestion.get(response.questionId);
    return sum + (question && response.answer === 'yes' ? question.weighting : 0);
  }, 0);
  const maxScore = responses.reduce((sum, response) => sum + (byQuestion.get(response.questionId)?.weighting ?? 0), 0);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
  return { score, maxScore, percentage, rating: calculateOakerRating(percentage) };
}
