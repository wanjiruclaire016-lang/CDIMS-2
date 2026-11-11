export interface SubCountyInfo {
  name: string;
  wards: string[];
}

export const MACHAKOS_SUB_COUNTIES: SubCountyInfo[] = [
  {
    name: 'Machakos Town',
    wards: ['Machakos Central', 'Muvuti/Kiima-Kimwe', 'Mutituni', 'Mumbuni North', 'Mwala', 'Kalama', 'Kola'],
  },
  {
    name: 'Kangundo',
    wards: ['Kangundo North', 'Kangundo Central', 'Kangundo East', 'Kangundo West'],
  },
  {
    name: 'Kathiani',
    wards: ['Mitaboni', 'Kathiani Central', 'Upper Kaewa/Iveti', 'Lower Kaewa/Kaani'],
  },
  {
    name: 'Matungulu',
    wards: ['Tala', 'Matungulu North', 'Matungulu East', 'Matungulu West', 'Kyeleni'],
  },
  {
    name: 'Masinga',
    wards: ['Kivaa', 'Masinga Central', 'Ekalakala', 'Muthesya', 'Ndithini'],
  },
  {
    name: 'Yatta',
    wards: ['Ndalani', 'Matuu', 'Kithimani', 'Ikombe', 'Katangi'],
  },
  {
    name: 'Mwala',
    wards: ['Mbiuni', 'Makutano/Mwala', 'Masii', 'Muthetheni', 'Wamunyu', 'Kibauni'],
  },
  {
    name: 'Mavoko (Athi River)',
    wards: ['Athi River', 'Kinanie', 'Muthwani', 'Syokimau/Mulolongo'],
  },
];

export const COMMON_CROPS = [
  'Cassava (Mihogo)',
  'Maize (Mahindi)',
  'Beans (Maharagwe)',
  'Tomato (Nyanya)',
  'Coffee (Kahawa)',
  'Avocado (Parachichi)',
  'Sweet Potato (Viazi Vitamu)',
  'Kale / Sukuma Wiki',
  'Pigeon Peas (Mbaazi)',
  'Cowpeas (Kunde)',
  'Sorghum (Mtama)',
  'Mango (Embe)',
];

export const SUBMIT_CASE_CROPS = [
  'Maize (Mahindi)',
  'Cassava (Mihogo)',
  'Beans (Maharagwe)',
  'Tomato (Nyanya)',
  'Sorghum',
  'Kale (Sukuma wiki)',
  'Other',
] as const;

export const CROP_DISEASES_PRESETS: { [crop: string]: string[] } = {
  'Cassava (Mihogo)': [
    'Cassava Mosaic Disease (CMD)',
    'Cassava Brown Streak Disease (CBSD)',
    'Cassava Bacterial Blight (CBB)',
    'Cassava Anthracnose Disease (CAD)',
    'Root Rot (Kuoza kwa Mizizi)',
    'Cassava Green Mite Damage',
  ],
  'Maize (Mahindi)': [
    'Maize Lethal Necrosis Disease (MLND)',
    'Fall Armyworm Infestation',
    'Northern Corn Leaf Blight',
    'Common Rust',
    'Maize Streak Virus',
  ],
  'Beans (Maharagwe)': [
    'Bean Common Mosaic Virus',
    'Bean Anthracnose',
    'Angular Leaf Spot',
    'Root Rot',
    'Bean Rust',
  ],
  'Tomato (Nyanya)': [
    'Early Blight',
    'Late Blight',
    'Tomato Yellow Leaf Curl Virus',
    'Bacterial Wilt',
    'Tuta Absoluta Infestation',
  ],
  'Sweet Potato (Viazi Vitamu)': [
    'Sweet Potato Feathery Mottle Virus (SPFMV)',
    'Sweet Potato Chlorotic Stunt Virus (SPCSV)',
    'Sweet Potato Weevil Damage',
  ],
  'Coffee (Kahawa)': [
    'Coffee Berry Disease (CBD)',
    'Coffee Leaf Rust (CLR)',
    'Bacterial Blight of Coffee (BBC)',
    'Coffee Root Rot',
  ],
  'Avocado (Parachichi)': [
    'Phytophthora Root Rot & Dieback',
    'Avocado Anthracnose',
    'Pseudocercospora Black Spot',
  ],
  'Kale / Sukuma Wiki': [
    'Black Rot of Brassicas',
    'Diamondback Moth (DBM)',
    'Alternaria Leaf Spot',
    'Downy Mildew',
  ],
};
