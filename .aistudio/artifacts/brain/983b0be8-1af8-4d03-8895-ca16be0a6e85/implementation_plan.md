# Implementation Plan: Comprehensive Crop & Plant Disease Library

Build an exhaustive, clinical-grade **Crop & Plant Disease Library** covering all common diseases and pests across major regional staples, horticulture, and cash crops (Cassava, Maize, Beans, Tomatoes, Sweet Potatoes, Coffee, Avocado, Brassicas/Sukuma Wiki, Mango, and Legumes).

---

## 1. Scope & Disease Coverage

The library will provide a curated encyclopedia with both English and Kiswahili translations, visual references, symptom checklists, cultural/organic management, and chemical treatment regimens:

1. **Cassava (Mihogo)**:
   - *Cassava Mosaic Disease (CMD)*: Severe leaf curling, mosaic patterns, whitefly transmission, resistant varieties (e.g., KME 1, MH95).
   - *Cassava Brown Streak Disease (CBSD)*: Feathery chlorosis along veins, brown corky necrosis in tuberous roots, clean cutting selection.
   - *Cassava Bacterial Blight (CBB)*: Angular water-soaked leaf spots, gum exudation, systemic wilting.
   - *Cassava Anthracnose (CAD)*: Cankers on stems and branches, leaf spot with necrotic rings.
   - *Root Rot Complex*: Phytophthora and Fusarium soft/dry decay, raised ridge drainage.
   - *Cassava Green Mite*: Chlorotic speckling, stunted shoot tips, predatory mite biocontrol.

2. **Maize (Mahindi)**:
   - *Maize Lethal Necrosis Disease (MLND)*: Dead heart, premature plant death, chlorotic mottling, strict crop rotation.
   - *Fall Armyworm (Spodoptera frugiperda)*: Ragged leaves, frass accumulation in whorls, pheromone traps, emamectin benzoate / neem.
   - *Northern Corn Leaf Blight (NCLB)*: Long cigar-shaped gray/green lesions, resistant hybrids.
   - *Maize Streak Virus (MSV)*: Continuous chlorotic stripes parallel to leaf veins, leafhopper control.
   - *Common Rust (Puccinia sorghi)*: Golden-brown to powdery brown pustules on upper and lower leaves.
   - *Gray Leaf Spot (GLS)*: Rectangular narrow tan lesions delimited by leaf veins.

3. **Beans & Legumes (Maharagwe, Mbaazi, Kunde)**:
   - *Bean Anthracnose*: Dark red to black sunken lesions along leaf veins and pods, certified seed use.
   - *Bean Common Mosaic Virus (BCMV)*: Mottling, leaf blistering, downward leaf cupping.
   - *Angular Leaf Spot (ALS)*: Geometric/angular lesions bordered by small veins, copper sprays.
   - *Bean Rust*: Reddish-brown pustules encircled by a chlorotic halo.
   - *Fusarium Wilt of Pigeon Pea*: Vascular browning, branch-by-branch wilting in dry spells.

4. **Tomato & Solanaceous (Nyanya)**:
   - *Late Blight (Phytophthora infestans)*: Water-soaked dark lesions, white fungal bloom under leaves during humid weather.
   - *Early Blight (Alternaria solani)*: Concentric rings / target-like spots on older leaves.
   - *Bacterial Wilt (Ralstonia solanacearum)*: Rapid wilting without yellowing, bacterial streaming in clear water test.
   - *Tomato Yellow Leaf Curl Virus (TYLCV)*: Stunted bushy growth, cupped yellow leaf edges, whitefly vector control.
   - *Tuta Absoluta (Tomato Leafminer)*: Transparent mines in leaves, pinhole tunneling in fruits.

5. **Sweet Potato (Viazi Vitamu)**:
   - *Sweet Potato Feathery Mottle Virus (SPFMV)*: Purple ring spots, vein feathering.
   - *Sweet Potato Virus Disease (SPVD)*: Synergistic stunting and chlorosis, tissue culture vines.
   - *Sweet Potato Weevil*: Tuber tunneling, bitter taste, hilling up soil.

6. **Coffee (Kahawa)**:
   - *Coffee Berry Disease (CBD)*: Dark sunken anthracnose lesions on green expanding berries.
   - *Coffee Leaf Rust (CLR)*: Bright orange powdery spore patches on leaf undersides.
   - *Bacterial Blight of Coffee (BBC)*: Blackened water-soaked shoot tips and leaves.

7. **Avocado (Parachichi)**:
   - *Root Rot & Tree Decline (Phytophthora cinnamomi)*: Sparse foliage, branch dieback, phosphonate stem injections.
   - *Anthracnose*: Dark circular rotting on ripening skin and fruit flesh.
   - *Pseudocercospora Black Spot*: Brown angular lesions on leaves and fruit peel.

8. **Brassicas & Greens (Sukuma Wiki, Cabbage)**:
   - *Black Rot (Xanthomonas campestris)*: V-shaped yellow/brown lesions progressing inward from leaf margins.
   - *Diamondback Moth*: Windowing of leaves by small green larvae.

---

## 2. Technical Architecture & Components

1. **`src/utils/diseaseDatabase.ts`**:
   - Comprehensive pre-bundled database containing 25+ detailed disease profiles.
   - Zero-latency, instant offline availability: even before Firestore network calls resolve or if offline, the library functions completely.
   - Helper search, crop filtering, symptom tag matching, and category grouping functions.

2. **`src/views/DiseaseLibraryView.tsx`**:
   - **Visual Crop Selector**: Quick-filter by crop badges (Cassava, Maize, Beans, Tomato, Sweet Potato, Coffee, Avocado, Brassicas, Legumes).
   - **Symptom Category Filter**: Leaves (Curling, Spots, Holes, Blight), Stems & Shoots, Roots/Tubers, Fruits/Berries, Insect Pests.
   - **Search Engine**: Multi-field search querying English names, Swahili names, pathogen/vector, symptoms, and treatments.
   - **Card Grid**: High-density cards showing crop badge, symptom summary, severity indicator, and reference photos.
   - **Deep-Dive Modal**:
     - Pathogen & vector taxonomy.
     - Field identification checklist with high-res reference photos.
     - Preventive cultural controls & organic farmer-friendly practices.
     - Registered chemical and biological treatments with spray schedules and safety precautions.
     - **"Report This Issue / Open Case" Action**: Clicking this directly pre-populates a new case submission with the selected crop and suspected disease details!

3. **Admin & Officer Live Management**:
   - Add/edit disease entries directly to Firestore (`diseases` collection).
   - One-click "Sync / Seed Full Expert Library" button for Admins and Super Admin to publish or update the full library in Firestore with automatic audit logging.

4. **Security & Data Integrity**:
   - Reads: Public (farmers, officers, guests, admins).
   - Writes: Verified Extension Officers and County Admins (`isAdmin() || isOfficer()`).
   - Firestore security rules updated and deployed to permit verified extension officers to publish new field guides.

---

## 3. Step-by-Step Implementation Steps

1. **Create `src/utils/diseaseDatabase.ts`**:
   - Populate with all common crop diseases across 8 major crop categories with clinical descriptions, symptoms, prevention, treatments, and Swahili translations.
2. **Upgrade `firestore.rules` & Deploy**:
   - Allow verified officers and admins to write/update diseases. Deploy rules.
3. **Enhance `DiseaseLibraryView.tsx`**:
   - Implement multi-criteria search, symptom filter chips, quick crop switcher, rich modal viewer, and "Report This Issue" link.
   - Include the Admin/Officer "Add Disease" / "Sync to Firestore" tools.
4. **Wire Deep Link from Library to Case Submission**:
   - Ensure clicking "Report Issue on My Farm" navigates to the New Case form with pre-selected crop and description.
5. **Compile, Test & Verify**:
   - Run unit tests, lint validation, and verify dev build.
