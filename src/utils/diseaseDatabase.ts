import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DiseaseItem } from '../types';

export interface DiseaseSeed {
  slug: string;
  crop: 'Maize' | 'Beans' | 'Cassava' | 'Mango' | 'Tomato' | 'Kale' | 'Cowpea' | 'Pigeon pea' | 'Sorghum' | 'Sweet Potato' | 'Coffee' | 'Avocado';
  nameEn: string;
  nameSw: string;
  scientificCause: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  affectedParts: ('leaves' | 'stem' | 'roots' | 'fruit' | 'flower' | 'wilt' | 'pests')[];
  symptoms: string;
  spread: string;
  treatment: string;
  prevention: string;
  images: { url: string; caption?: string; part?: string; credit?: string; license?: string }[];
  reviewedBy: string;
  reviewedAt: string;
}

export const SEED_DISEASES: DiseaseSeed[] = [
  // CASSAVA
  {
    slug: 'cassava-cmd',
    crop: 'Cassava',
    nameEn: 'Cassava Mosaic Disease (CMD)',
    nameSw: 'Ugonjwa wa Ukoma wa Mihogo',
    scientificCause: 'Cassava mosaic begomovirus (Geminiviridae)',
    severity: 'HIGH',
    affectedParts: ['leaves'],
    symptoms: 'Severe mosaic pattern on leaves (yellow and green patches), distortion, puckering, twisted leaf blades, and severe stunting of entire plants. Yield loss up to 80%.',
    spread: 'Transmitted by whiteflies (Bemisia tabaci) and by taking cuttings from infected mother plants.',
    treatment: 'No chemical cure. Immediately uproot and burn symptomatic shrubs to stop transmission to adjacent plots.',
    prevention: 'Plant certified disease-free cuttings of resistant varieties such as KME 1, KME 4, and MH95. Rogue infected plants early.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'cassava-cbsd',
    crop: 'Cassava',
    nameEn: 'Cassava Brown Streak Disease (CBSD)',
    nameSw: 'Ugonjwa wa Michirizi ya Kahawia ya Mihogo',
    scientificCause: 'Cassava brown streak ipomovirus (Potyviridae)',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem', 'roots'],
    symptoms: 'Feathery yellowing along tertiary leaf veins without distortion. Brown streaking on green stems. Dry, corky brown necrosis in tuber flesh, rendering roots completely inedible.',
    spread: 'Spread primarily through planting diseased stem cuttings and transmitted by adult whiteflies.',
    treatment: 'Infected plants cannot recover. Harvest tubers early if mild, and safely destroy infected stem debris away from farm boundaries.',
    prevention: 'Obtain disease-tested stems from registered KALRO/KePHIS seed multiplication nurseries. Avoid taking planting material from unknown local fields.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'cassava-cbb',
    crop: 'Cassava',
    nameEn: 'Cassava Bacterial Blight (CBB)',
    nameSw: 'Kinyausi cha Bakteria cha Mihogo',
    scientificCause: 'Xanthomonas axonopodis pv. manihotis',
    severity: 'MODERATE',
    affectedParts: ['leaves', 'stem'],
    symptoms: 'Angular, water-soaked leaf spots turning brown, gum exudation on young stems, leaf blighting and premature defoliation leaving a candle-like stalk.',
    spread: 'Bacterial pathogen spread by wind-driven rain splashes, contaminated pruning tools, and infected planting stakes.',
    treatment: 'Prune affected branches 20cm below infection margin during dry days and burn cuttings.',
    prevention: 'Disinfect field cutting tools in 10% household bleach between plants. Plant during dry spells if possible and use tolerant varieties.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'cassava-root-rot',
    crop: 'Cassava',
    nameEn: 'Cassava Root Rot Complex',
    nameSw: 'Kuoza kwa Mizizi ya Mihogo',
    scientificCause: 'Phytophthora drechsleri & Fusarium spp.',
    severity: 'MODERATE',
    affectedParts: ['roots'],
    symptoms: 'Sudden yellowing and wilting of canopy. Tubers develop foul-smelling soft watery decay or dry sunken rot under waterlogged soil conditions.',
    spread: 'Soilborne fungi thriving in compacted, poorly drained clay soils and stagnant water.',
    treatment: 'Improve furrow drainage immediately. Harvest remaining healthy roots before rain peaks.',
    prevention: 'Plant on raised ridges or mounds to facilitate drainage. Avoid low-lying depressions prone to flooding.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // MAIZE
  {
    slug: 'maize-mlnd',
    crop: 'Maize',
    nameEn: 'Maize Lethal Necrosis Disease (MLND)',
    nameSw: 'Ugonjwa Hatari wa Mahindi (MLND)',
    scientificCause: 'Maize chlorotic mottle virus + Sugarcane mosaic virus',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem'],
    symptoms: 'Chlorotic leaf mottling starting at margins, progressing into dead-heart necrosis, premature drying of husks, small deformed or sterile cobs.',
    spread: 'Synergistic co-infection spread by corn thrips, cereal flea beetles, and aphids, as well as recycling uncertified grains.',
    treatment: 'Uproot and bury or burn symptomatic plants immediately. Never feed MLND-infected biomass to livestock near adjacent green fields.',
    prevention: 'Strictly observe a 2-month maize-free window between cropping seasons. Rotate with non-host legumes. Only purchase KePHIS-certified seeds.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'maize-fall-armyworm',
    crop: 'Maize',
    nameEn: 'Fall Armyworm (FAW)',
    nameSw: 'Funza wa Jeshi (FAW)',
    scientificCause: 'Spodoptera frugiperda',
    severity: 'HIGH',
    affectedParts: ['leaves', 'fruit'],
    symptoms: 'Window-pane feeding on leaves, ragged leaf tears, accumulation of sawdust-like moist frass in the central whorl, and bore holes in cobs.',
    spread: 'Migratory night-flying moth depositing egg masses covered in tan scales on leaf surfaces.',
    treatment: 'Hand-pick caterpillars in small plots. Apply fine sand mixed with wood ash (1:1 ratio) or registered bio-pesticides directly into whorls.',
    prevention: 'Scout 20 consecutive plants weekly. Install pheromone lures at field borders. Plant at onset of rains.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'maize-nclb',
    crop: 'Maize',
    nameEn: 'Northern Corn Leaf Blight (NCLB)',
    nameSw: 'Madoa Marefu ya Majani ya Mahindi',
    scientificCause: 'Exserohilum turcicum',
    severity: 'MODERATE',
    affectedParts: ['leaves'],
    symptoms: 'Long, elliptical, cigar-shaped grayish-green lesions (2.5 to 15 cm long) that turn tan with dark spore rings during humid periods.',
    spread: 'Fungal spores overwintering on infected maize residue blown onto leaves by wind during cool, moist periods.',
    treatment: 'Strip heavily blighted lower leaves if infection appears prior to tasseling.',
    prevention: 'Deep plough crop residues immediately after harvest. Select NCLB-tolerant certified hybrids.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'maize-streak-virus',
    crop: 'Maize',
    nameEn: 'Maize Streak Virus (MSV)',
    nameSw: 'Virusi vya Mistari ya Mahindi',
    scientificCause: 'Maize streak mastrevirus (Geminiviridae)',
    severity: 'MODERATE',
    affectedParts: ['leaves'],
    symptoms: 'Narrow, chlorotic, continuous yellow-white streaks parallel to leaf veins extending the entire length of the blade. Stunted plants with sterile tassels.',
    spread: 'Transmitted by leafhoppers (Cicadulina mbila) moving from wild grasses to young maize.',
    treatment: 'No viral cure. Rogue infected plants within the first 3 weeks if incidence is below 5%.',
    prevention: 'Plant at onset of rains to outpace leafhopper peak populations. Keep farm borders free of grassy weeds.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'maize-grey-leaf-spot',
    crop: 'Maize',
    nameEn: 'Grey Leaf Spot',
    nameSw: '',
    scientificCause: 'Fungus (Cercospora zeae-maydis)',
    severity: 'MODERATE',
    affectedParts: ['leaves'],
    symptoms: 'Narrow rectangular grey-to-tan spots between the leaf veins that join up and burn the leaves.',
    spread: 'Infected crop residue, warm and humid weather.',
    treatment: 'Rotate crops, bury or remove crop residue, plant tolerant varieties, avoid very dense planting.',
    prevention: 'Rotate crops, bury or remove crop residue, plant tolerant varieties, avoid very dense planting.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-11-11'
  },

  // BEANS
  {
    slug: 'beans-anthracnose',
    crop: 'Beans',
    nameEn: 'Bean Anthracnose',
    nameSw: 'Ukungu wa Anthracnose wa Maharagwe',
    scientificCause: 'Colletotrichum lindemuthianum',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem', 'fruit'],
    symptoms: 'Dark reddish-purple to black sunken lesions along leaf veins on undersides. Sunken circular spots with pink spore masses on pods. Discolored, shriveled beans.',
    spread: 'Seed-borne fungal spores dispersed rapidly during cool, wet weather through water splashing and workers walking through wet foliage.',
    treatment: 'Do not cultivate or weed beans when morning dew or rain is present on the leaves.',
    prevention: 'Always plant certified disease-free seeds. Never save seeds from infected bean fields. Practice a 3-year crop rotation without legumes.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'beans-bcmv',
    crop: 'Beans',
    nameEn: 'Bean Common Mosaic Virus (BCMV)',
    nameSw: 'Virusi vya Ukoma wa Maharagwe (BCMV)',
    scientificCause: 'Bean common mosaic virus (Potyviridae)',
    severity: 'HIGH',
    affectedParts: ['leaves'],
    symptoms: 'Irregular light and dark green mosaic patterns on leaves, downward leaf curling, puckering, vein banding, and stunted pod development.',
    spread: 'Seed-borne virus transmitted by bean aphids (Aphis fabae) moving between weed hosts and bean plantings.',
    treatment: 'Rogue infected plants early. Avoid collecting seed for future seasons from mosaic-affected plots.',
    prevention: 'Plant certified virus-free seeds (e.g. resistant Rosecoco varieties). Control weed reservoirs along field boundaries.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'beans-angular-leaf-spot',
    crop: 'Beans',
    nameEn: 'Angular Leaf Spot (ALS)',
    nameSw: 'Madoa ya Pembe Pembe ya Maharagwe',
    scientificCause: 'Pseudocercospora griseola',
    severity: 'MODERATE',
    affectedParts: ['leaves', 'fruit'],
    symptoms: 'Grey to tan angular spots bounded strictly by small leaf veins. Premature yellowing and leaf fall. Pods display circular reddish-brown sunken patches.',
    spread: 'Fungal infection favored by warm, humid daytime temperatures alternating with cool nights.',
    treatment: 'Remove and destroy heavily spotted lower leaves before flowering.',
    prevention: 'Intercrop with maize. Bury crop stubble immediately after threshing. Plant tolerant bean varieties like KAT B1, KAT B9, or Rosecoco (GLP-2).',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'beans-rust',
    crop: 'Beans',
    nameEn: 'Bean Rust',
    nameSw: 'Kutu ya Maharagwe',
    scientificCause: 'Uromyces appendiculatus',
    severity: 'MODERATE',
    affectedParts: ['leaves'],
    symptoms: 'Small, powdery, reddish-brown pustules predominantly on leaf undersides, surrounded by a distinct pale yellow halo. Leaves turn chlorotic and drop.',
    spread: 'Airborne rust spores dispersed across miles by prevailing winds during high relative humidity (>95%).',
    treatment: 'Rogue heavily crusted plants early before spores cloud onto neighboring rows.',
    prevention: 'Destroy wild legume weeds around plot perimeters. Rotate with cereals or sweet potatoes.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'beans-stem-maggot',
    crop: 'Beans',
    nameEn: 'Bean Stem Maggot',
    nameSw: '',
    scientificCause: 'Insect pest (Ophiomyia species)',
    severity: 'MODERATE',
    affectedParts: ['stem', 'pests'],
    symptoms: 'Seedlings wilt and die, swollen cracked stem base, small holes on leaves.',
    spread: 'Flies lay eggs on young seedlings.',
    treatment: 'Plant on time, earth up around the stem base, keep soil fertile to help recovery, seed treatment as advised by an extension officer.',
    prevention: 'Plant on time, earth up around the stem base, keep soil fertile to help recovery, seed treatment as advised by an extension officer.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-11-11'
  },

  // COWPEA
  {
    slug: 'cowpea-aphid-mosaic',
    crop: 'Cowpea',
    nameEn: 'Cowpea Aphid-Borne Mosaic',
    nameSw: 'Ukoma wa Virusi vya Kunde',
    scientificCause: 'Cowpea aphid-borne mosaic virus (CABMV)',
    severity: 'HIGH',
    affectedParts: ['leaves'],
    symptoms: 'Severe green vein-banding, blistering, distortion, and downward cupping of trifoliate leaves. Stunting and severe pod distortion.',
    spread: 'Seed-borne and non-persistently transmitted by aphids (Aphis craccivora).',
    treatment: 'Uproot infected seedlings immediately. Do not save seed from infected crop.',
    prevention: 'Use certified seed of resistant cowpea varieties (e.g. Machakos 66, K80). Intercrop with sorghum or maize.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'cowpea-bacterial-blight',
    crop: 'Cowpea',
    nameEn: 'Cowpea Bacterial Blight',
    nameSw: 'Kinyausi cha Bakteria cha Kunde',
    scientificCause: 'Xanthomonas axonopodis pv. vignicola',
    severity: 'MODERATE',
    affectedParts: ['leaves', 'stem'],
    symptoms: 'Water-soaked spots turning into circular to angular reddish-brown lesions with yellow halos. Stem cankers can crack open and cause lodging.',
    spread: 'Transmitted on seed and spread in the field by wind-driven rain and mechanical contact.',
    treatment: 'Prune diseased leaves during dry weather. Spray protective copper bactericides.',
    prevention: 'Plant certified pathogen-free seed. Avoid overhead sprinkler irrigation.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // PIGEON PEA
  {
    slug: 'pigeon-pea-fusarium-wilt',
    crop: 'Pigeon pea',
    nameEn: 'Pigeon Pea Fusarium Wilt',
    nameSw: 'Mnyauko wa Mbaazi (Fusarium)',
    scientificCause: 'Fusarium udum',
    severity: 'HIGH',
    affectedParts: ['stem', 'roots'],
    symptoms: 'Gradual wilting and yellowing starting on one branch or half the shrub. Splitting the main stem reveals a dark purple-black vascular ring under the bark.',
    spread: 'Persistent soilborne fungal chlamydospores surviving in soil for over 5 years.',
    treatment: 'No chemical cure in established plants. Immediately dig out roots of wilted plants and burn outside the field.',
    prevention: 'Plant wilt-resistant varieties such as ICEAP 00040 or KAT 60/8. Rotate pigeon peas with sorghum or finger millet.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'pigeon-pea-pod-borer',
    crop: 'Pigeon pea',
    nameEn: 'Pigeon Pea Pod Borer',
    nameSw: 'Kipekecha cha Maganda ya Mbaazi',
    scientificCause: 'Helicoverpa armigera & Maruca vitrata',
    severity: 'MODERATE',
    affectedParts: ['flower', 'fruit'],
    symptoms: 'Larvae feed inside flower buds and chew round entry holes into developing pods, consuming seeds directly and leaving webbed frass.',
    spread: 'Adult moths lay eggs on flower buds and young pods during flowering season.',
    treatment: 'Hand-pick caterpillars where feasible. Spray Bacillus thuringiensis (Bt) at peak flowering.',
    prevention: 'Synchronized early sowing in the community. Intercrop with sorghum or sunflower to attract beneficial predators.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // SORGHUM
  {
    slug: 'sorghum-anthracnose',
    crop: 'Sorghum',
    nameEn: 'Sorghum Anthracnose',
    nameSw: 'Ukungu wa Anthracnose wa Mtama',
    scientificCause: 'Colletotrichum sublineolum',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem'],
    symptoms: 'Small, circular to elliptical reddish-purple or tan leaf spots with dark borders. In severe cases, lesions merge causing complete foliage blight and red rot in stalks.',
    spread: 'Wind-blown and rain-splashed conidia from infected residue and wild sorghum grasses.',
    treatment: 'Bury infected stubble deep after harvest. Avoid cultivating while plants are wet.',
    prevention: 'Grow anthracnose-tolerant varieties (e.g. Gadam, Serena). Rotate with legumes such as cowpea or beans.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'sorghum-head-smut',
    crop: 'Sorghum',
    nameEn: 'Sorghum Head Smut',
    nameSw: 'Ukungu wa Koga wa Mtama',
    scientificCause: 'Sporisorium reilianum',
    severity: 'MODERATE',
    affectedParts: ['flower', 'fruit'],
    symptoms: 'Panicle is completely replaced by a large fungal gall covered with a thin white membrane that ruptures to release dark brown powdery spore masses.',
    spread: 'Soilborne teliospores germinate into root tips of seedlings and grow systemically.',
    treatment: 'Carefully cut off infected heads into sacks and burn before spores disperse onto the soil.',
    prevention: 'Treat seed with Thiram or systemic fungicides before sowing. Rotate crops for at least 3 years.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // TOMATO
  {
    slug: 'tomato-late-blight',
    crop: 'Tomato',
    nameEn: 'Late Blight of Tomato',
    nameSw: 'Kinyausi cha Nyanya (Late Blight)',
    scientificCause: 'Phytophthora infestans',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem', 'fruit'],
    symptoms: 'Irregular, dark, water-soaked oily spots on leaves that rapidly enlarge into papery brown patches. White moldy growth on leaf undersides in morning dew. Greasy brown rot on green fruit.',
    spread: 'Oomycete pathogen exploding in cool (15-20°C), wet, foggy conditions with persistent moisture on foliage.',
    treatment: 'Prune infected leaves on dry sunny days. Destroy infected fruits immediately.',
    prevention: 'Stake and prune indeterminate tomatoes to improve airflow. Use drip irrigation instead of overhead sprinklers. Avoid planting near potato patches.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'tomato-bacterial-wilt',
    crop: 'Tomato',
    nameEn: 'Tomato Bacterial Wilt',
    nameSw: 'Kunyauka kwa Bakteria wa Nyanya',
    scientificCause: 'Ralstonia solanacearum',
    severity: 'HIGH',
    affectedParts: ['stem', 'roots'],
    symptoms: 'Rapid wilting of entire plant during hot sunny hours while leaves remain green. Clear water test: cut lower stem placed in clean glass produces milky-white bacterial streaming threads.',
    spread: 'Soilborne bacteria entering through root wounds caused by transplanting, nematodes, or weeding tools.',
    treatment: 'No chemical cure. Remove wilting plants with root soil block and disinfect area with quicklime.',
    prevention: 'Graft commercial varieties onto resistant rootstocks. Practice 4-year crop rotations excluding solanaceous crops. Control root-knot nematodes.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'tomato-tuta-absoluta',
    crop: 'Tomato',
    nameEn: 'Tuta Absoluta (Tomato Leafminer)',
    nameSw: 'Mdudu Mchimbaji wa Nyanya (Tuta)',
    scientificCause: 'Phthorimaea absoluta',
    severity: 'HIGH',
    affectedParts: ['leaves', 'fruit'],
    symptoms: 'Blotch-like transparent mines in leaves containing dark frass granules. Caterpillars bore into flower buds, green and ripe fruits leaving pin-sized holes and fungal rot.',
    spread: 'Prolific micro-moth laying hundreds of eggs; larvae burrow inside leaf mesophyll protected from contact insecticides.',
    treatment: 'Hand-crush mined leaves when larvae are small. Install pheromone traps for mass trapping.',
    prevention: 'Install insect netting over nurseries. Practice regular crop hygiene and destroy all post-harvest solanaceous residue.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // KALE
  {
    slug: 'kale-black-rot',
    crop: 'Kale',
    nameEn: 'Black Rot of Brassicas',
    nameSw: 'Kuoza Jeusi kwa Sukuma Wiki',
    scientificCause: 'Xanthomonas campestris pv. campestris',
    severity: 'HIGH',
    affectedParts: ['leaves', 'stem'],
    symptoms: 'Distinct yellow V-shaped lesions starting at leaf margins with base of V pointing toward leaf midrib. Leaf veins turn black. Severe defoliation and bitter taste.',
    spread: 'Seed-borne bacterium entering through hydathodes (water pores on leaf margins) via rain splash and warm humid weather (25-30°C).',
    treatment: 'Promptly harvest healthy leaves and pull up severely infected stalks; do not feed diseased kale to livestock on the farm.',
    prevention: 'Hot water treat seeds at 50°C for 25 minutes prior to nursery sowing. Avoid overhead sprinkler watering.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'kale-dbm',
    crop: 'Kale',
    nameEn: 'Diamondback Moth (DBM)',
    nameSw: 'Nondo wa Sukuma Wiki na Kabichi',
    scientificCause: 'Plutella xylostella',
    severity: 'MODERATE',
    affectedParts: ['leaves'],
    symptoms: 'Small pale-green wriggling caterpillars feed on leaf undersides, creating typical "window pane" feeding holes. Leaves become skeletonized with silk webbing.',
    spread: 'Fast-reproducing small grey moth; pest develops resistance to chemical sprays rapidly.',
    treatment: 'Handpick caterpillars and pupae on young plants. Spray registered bio-pesticides or neem extract.',
    prevention: 'Intercrop sukuma wiki with repellent companion plants like coriander, garlic, or tomatoes.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },

  // MANGO
  {
    slug: 'mango-fruit-fly',
    crop: 'Mango',
    nameEn: 'Mango Fruit Fly',
    nameSw: 'Inzi wa Matunda ya Maembe',
    scientificCause: 'Bactrocera dorsalis',
    severity: 'HIGH',
    affectedParts: ['fruit'],
    symptoms: 'Tiny dark puncture marks on mango skin with oozing sap. Fruit turns soft, rots internally around the seed, and drops prematurely. Maggots squirm in fruit pulp.',
    spread: 'Invasive fruit flies laying eggs beneath fruit skin; maggots hatch and consume pulp.',
    treatment: 'Collect fallen fruits daily and seal in black polythene bags left under direct sun for 48 hours to kill maggots.',
    prevention: 'Bag mango fruits with paper or cloth bags when golf-ball sized. Install methyl eugenol male-annihilation lure traps (4 traps/acre).',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  },
  {
    slug: 'mango-anthracnose',
    crop: 'Mango',
    nameEn: 'Mango Anthracnose',
    nameSw: 'Ukungu wa Anthracnose wa Maembe',
    scientificCause: 'Colletotrichum gloeosporioides',
    severity: 'MODERATE',
    affectedParts: ['leaves', 'flower', 'fruit'],
    symptoms: 'Black, sunken, irregular spots on leaves, blossom blight causing flower abortion, and tear-stain black lesions on fruit skins extending into rot during ripening.',
    spread: 'Airborne and rain-splashed fungal spores thriving during warm wet flowering periods.',
    treatment: 'Prune dead wood and twigs before flowering flushes. Clear fallen leaves.',
    prevention: 'Open tree canopy through regular pruning. Apply copper hydroxide fungicides at panicle emergence and fruit set.',
    images: [],
    reviewedBy: 'CropCare Centre Agronomy Board',
    reviewedAt: '2026-10-15'
  }
];

export function mapSeedToDiseaseItem(seed: DiseaseSeed): DiseaseItem {
  return {
    slug: seed.slug,
    id: seed.slug,
    crop: seed.crop,
    nameEn: seed.nameEn,
    nameSw: seed.nameSw,
    scientificCause: seed.scientificCause,
    severity: seed.severity,
    affectedParts: seed.affectedParts,
    symptoms: seed.symptoms,
    spread: seed.spread,
    treatment: seed.treatment,
    prevention: seed.prevention,
    images: seed.images || [],
    reviewedBy: seed.reviewedBy,
    reviewedAt: seed.reviewedAt,
    name: seed.nameEn,
    swahiliName: seed.nameSw,
    scientificName: seed.scientificCause,
    causes: seed.scientificCause,
    referencePhotoUrls: (seed.images || []).map(img => img.url),
  };
}

/**
 * Ensures diseases collection in Firestore is seeded.
 * Seeded with images: [] as strictly required.
 */
export async function seedDiseasesCollectionIfNeeded(): Promise<DiseaseItem[]> {
  try {
    const snap = await getDocs(collection(db, 'diseases'));
    if (!snap.empty) {
      const existingSlugs = new Set(snap.docs.map(d => d.data().slug || d.id));
      const existingItems = snap.docs.map(d => {
        const data = d.data();
        return {
          slug: data.slug || d.id,
          id: data.slug || d.id,
          crop: data.crop || 'Maize',
          nameEn: data.nameEn || data.name || d.id,
          nameSw: data.nameSw || data.swahiliName || '',
          scientificCause: data.scientificCause || data.scientificName || data.causes || '',
          severity: (data.severity as any) || 'MODERATE',
          affectedParts: data.affectedParts || data.symptomTags || ['leaves'],
          symptoms: data.symptoms || '',
          spread: data.spread || data.causes || '',
          treatment: data.treatment || '',
          prevention: data.prevention || '',
          images: Array.isArray(data.images) ? data.images : [],
          reviewedBy: data.reviewedBy || 'CropCare Centre Agronomy Board',
          reviewedAt: data.reviewedAt || '2026-10-15',
          name: data.nameEn || data.name,
          swahiliName: data.nameSw || data.swahiliName,
          scientificName: data.scientificCause || data.scientificName,
        } as DiseaseItem;
      });

      const missingSeeds = SEED_DISEASES.filter(seed => !existingSlugs.has(seed.slug));
      for (const seed of missingSeeds) {
        const item = mapSeedToDiseaseItem(seed);
        try {
          await setDoc(doc(db, 'diseases', seed.slug), item);
        } catch (writeErr) {
          console.warn(`Could not persist ${seed.slug} to Firestore:`, writeErr);
        }
        existingItems.push(item);
      }

      return existingItems;
    }

    // Seed into Firestore
    const items: DiseaseItem[] = [];
    for (const seed of SEED_DISEASES) {
      const item = mapSeedToDiseaseItem(seed);
      await setDoc(doc(db, 'diseases', seed.slug), item);
      items.push(item);
    }
    return items;
  } catch (err) {
    console.warn('Failed to seed or fetch diseases from Firestore, falling back to local catalog:', err);
    return SEED_DISEASES.map(mapSeedToDiseaseItem);
  }
}

export const COMPREHENSIVE_DISEASE_CATALOG: DiseaseItem[] = SEED_DISEASES.map(mapSeedToDiseaseItem);
