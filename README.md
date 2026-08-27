# SentriQ

SentriQ helps NGOs track and monitor the health of their rescue dogs in real time. With smart collar technology, live health vitals and GPS location information are always at hand, so teams can focus on care instead of chasing spreadsheets.

## Key Features

- **Real-Time Health Monitoring** – Track heart rate, temperature, and activity levels across every dog you manage.
- **GPS Location Tracking** – Know where each dog is at all times with accurate GPS updates and geofencing alerts.
- **Instant Alerts** – Receive notifications when vitals go outside healthy ranges or when a dog leaves a designated area.
- **Health Reports** – Generate daily, weekly, monthly, or yearly PDF reports to share with stakeholders or veterinarians.
- **Medical Records Storage** – Securely store vaccination cards, prescriptions, and other medical documents per dog.
- **Community Support** – Connect with fellow NGOs, share best practices, and ask for advice within the SentriQ community.

## How It Works

1. **Create Your NGO Account** – Sign up with your organization details to unlock the dashboard.
2. **Add Your Dogs** – Register each rescue dog along with their profile and pair them with their smart collar.
3. **Start Monitoring** – Watch vitals, location, and alerts in real time from the central dashboard.
4. **Scale Compassion** – Use reports, alerts, and shared knowledge to improve care across your whole pack.

## Getting Started

1. Clone the repository:
   ```bash
   git clone <YOUR_GIT_URL>
   cd dogs-manager
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and set your project URL + anon key.
4. Run SQL migrations in order from `src/migrations/` (see `src/migrations/README.md` and `schema.txt`).
5. In Auth settings, disable email confirmation for smooth local signup (or confirm emails manually).
6. Run the development server:
   ```bash
   npm run dev
   ```

Dog profiles, auth, community, medical records, and history are stored in your project database. Live collar sensor data is matched by `device_id`.

The main UI lives under `src/` with the landing experience in `src/pages/Index.tsx`.

## Available Scripts

- `npm run dev` – start the Vite dev server with hot module replacement.
- `npm run build` – create a production build in `dist/`.
- `npm run preview` – preview the production build locally.

## Tech Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
