# DataRex - PDPA Compliance Portal

<p align="center">
  <img src="https://img.shields.io/badge/PDPA-2024%20Ready-green" alt="PDPA 2024 Ready">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/Version-1.0.0-orange" alt="Version">
</p>

DataRex is a web-based PDPA (Personal Data Protection Act) compliance portal designed to help organizations manage their data protection obligations. Built with simplicity in mind for first-time Data Protection Officers.

## Features

### Core Features
- 📝 **Registration** - Company registration with SSM/ROC number
- 🔐 **Dual Login** - Supabase + localStorage authentication
- 📊 **Dashboard** - Compliance score and quick actions
- 🏢 **Companies** - Multi-company support with sorting
- ✅ **Checklist** - Guided compliance checklist
- 🗄️ **Data Register** - Track personal data collected
- 🔒 **Consent Management** - Track consent settings
- 📅 **Retention** - Data retention policies
- 📄 **Documents** - Document management
- 👥 **Team** - Access control
- 📋 **Audit Reports** - Compliance reports

### Technical Features
- Local storage fallback for demo mode
- Supabase backend integration
- Responsive design
- Real-time state management

## Tech Stack

| Component | Technology |
|----------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth + localStorage |
| Storage | Browser localStorage (demo) |
| Testing | pytest + Playwright |

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari)
- Supabase account (optional, for production)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/v3x5exia555/data_reg.git
cd data_reg
```

2. **Start the local server**
```bash
# Using Python
python3 -m http.server 8050

# Or using the script
./start.sh
```

3. **Open in browser**
```
http://localhost:8050
```

### Demo Credentials
```
Email: admin@datarex.com
Password: Admin123!@#
```

## Usage

### Registration Flow
1. Click "Start for free" or "Get started free"
2. Click "Create Account"
3. Fill in company details including SSM/ROC number
4. Continue to onboarding
5. Select data sources
6. Finish setup
7. View summary and go to dashboard

### Managing Companies
- Navigate to Companies page
- Click column headers to sort
- Click "Switch" to change active company
- Use "Add company" to add new organizations

### Data Register
- Add personal data records
- Track data type, purpose, storage
- Set access levels and retention periods

## Project Structure

```
data_reg/
├── index.html           # Main application
├── js/
│   ├── app.js        # Main JavaScript
│   └── env.js       # Supabase config
├── css/
│   └── style.css    # Styles
├── supabase/
│   └── migrations/  # Database migrations
├── test_api.py       # API tests (23 tests)
├── test_datarex.py  # Frontend tests (25 tests)
└── deploy-uat.sh   # Deployment script
```

## Running Tests

### API Tests
```bash
python3 -m pytest test_api.py -v
```

### Frontend Tests
```bash
python3 -m pytest test_datarex.py -v
```

### All Tests
```bash
./deploy-uat.sh all
```

## Supabase Setup

### Database Tables
- `app_credentials` - User authentication
- `companies` - Company records
- `consent_settings` - Consent configurations
- `checklist_items` - Compliance checklist
- `data_records` - Personal data register
- `documents` - Document storage
- `team_members` - Team access

### Running Migrations
1. Go to Supabase SQL Editor
2. Run migrations from `supabase/migrations/`

## Configuration

### Environment Variables
Create `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_anon_key
```

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.

---

<p align="center">Made with ❤️ for Data Protection Officers</p>