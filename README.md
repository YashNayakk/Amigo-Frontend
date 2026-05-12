# 🤝 Amigo — Habit Tracker with Social Witness

> Build habits. Stay accountable. Witness each other's journey.

Most habit apps are a solo game. **Amigo is different.**

Amigo pairs you with real people — your **witnesses** — who see your progress, share their own work cards with you in real time, and keep you honest through streaks and shared goals. It's not just about tracking habits. It's about doing hard things with people who actually care.

---

## ✨ What Makes Amigo Different

| Feature | What it does |
|---|---|
| 🧠 **Habit Tracking** | Yes/No habits or measurable ones — *"How many pages did you read?"* |
| 👁️ **Witness System** | Add friends as witnesses. They see your progress. You see theirs. |
| 🃏 **Live Card Sharing** | Share work cards (DSA progress, study sessions, etc.) in real time via Socket.IO |
| 📅 **Daily Check-in** | Start your day consciously with a quick check-in ritual |
| 📊 **Performance Tracking** | Habits + check-ins analyzed with graphs, scores, and a momentum algorithm |
| 🔁 **Witness Streaks** | You and your witness build a shared streak — break it and you both feel it |
| 👥 **Pods** | Form a group of witnesses working toward a collective goal |
| 📵 **Flip-phone Mode** | Uses device sensors to detect phone face-down — your focus time, enforced |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [React Native CLI](https://reactnative.dev/docs/environment-setup)
- [MongoDB](https://www.mongodb.com/) (local or Atlas)
- Android Studio / Xcode or a physical device

### Installation

```bash
git clone https://github.com/YashNayakk/Amigo-Frontend.git
cd Amigo-Frontend
npm install

# iOS only
cd ios && pod install && cd ..
```

### Environment Setup

Create a `.env` file in the root:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret
SOCKET_PORT=5001
```

### Run It

```bash
# Backend
cd server && npm run dev

# React Native (new terminal)
npx react-native start

# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Mobile** | React Native |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB |
| **API** | REST |
| **Real-time** | Socket.IO |
| **Sensors** | React Native device sensors |

### Project Structure

```
Amigo/
├── client/
│   ├── screens/          # App screens
│   ├── components/       # Reusable UI components
│   └── utils/            # Helpers & sensor logic
├── server/
│   ├── routes/           # REST API routes
│   ├── models/           # MongoDB schemas
│   ├── controllers/      # Business logic
│   └── socket/           # Socket.IO handlers
└── README.md
```

---

## 🗺️ How It Works

**1. Sign Up & Check In**
Create your account and start each day with a daily check-in — a small ritual to set your intention.

**2. Build Your Habits**
Add habits that matter. Simple yes/no ("Did you meditate?") or measurable ("How many pages?"). Amigo tracks both.

**3. Find Your Witnesses**
Search for friends and send a witness request. Once connected, you're in each other's world.

**4. Share Work Cards**
Finished a study session? Share a card — your witnesses see it live instantly, no refresh needed.

**5. Track Your Momentum**
Your check-ins and habits feed into a personal score and momentum graph. See your consistency, not just your streaks.

**6. Build Streaks Together**
Maintain a shared streak with your witness. It's not just your habit on the line — it's both of yours.

**7. Form Pods**
Got a group working toward something bigger? Create a Pod — a shared witness group with a collective goal.

**8. Stay Off Your Phone**
Flip your phone face-down. Amigo's sensor mode detects it and tracks your focus time. That's the whole point.

---

## 🔧 What's Need Improved

- 🔐 **Authentication** — making it more secure
- 🃏 **Card Sharing** — Socket.IO stability improvements  
- 🎨 **UI** — cleaner, smoother, few changes
- ⚠️ **Error Handling** — better error handling & feedback everywhere

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "Add: your feature"`
4. Push & open a Pull Request

For major changes, open an issue first.

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/YashNayakk">Yash Nayak</a>
  <br/>
  <i>Because accountability is better together.</i>
</div>