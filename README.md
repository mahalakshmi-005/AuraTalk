````md
# 💬 AuraTalk

> Real-time full-stack chat application built with Node.js, Socket.io & MongoDB.
---

## 🌐 Live Demo

**[https://auratalk-7fkw.onrender.com](https://auratalk-7fkw.onrender.com)**

---

## ✨ Features

- 🌍 **Public Chat** — Talk with everyone in General Chat
- 🔒 **Private Messaging** — Direct messages between users
- ✅ **Message Status** — Sent → Delivered → Seen (blue ticks)
- 📷 **Image Sharing** — Send images in chat
- 🗑️ **Delete Messages** — Long press to delete your messages
- 😊 **Emoji Picker** — 400+ emojis across 7 categories
- 👤 **User Profiles** — Custom avatar & about section
- 🔔 **Toast Notifications** — Real-time message alerts
- ⌨️ **Typing Indicator** — See when someone is typing
- 🔍 **User Search** — Search users instantly
- 🌙 **Dark / Light Theme** — Toggle from settings
- 📱 **Mobile Responsive** — Works perfectly on all devices
- 🔐 **JWT Authentication** — Secure login & register

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Real-time** | Socket.io |
| **Database** | MongoDB Atlas + Mongoose |
| **Auth** | JWT + bcryptjs |
| **Hosting** | Render |

---

## 📁 Project Structure

```bash
AuraTalk/
├── client/
│   ├── index.html        # Login / Register page
│   ├── chat.html         # Main chat page
│   ├── css/
│   │   └── style.css     # Glassmorphism UI styles
│   └── js/
│       ├── auth.js       # Login & Register logic
│       └── chat.js       # Full chat functionality
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── models/
│   │   ├── User.js       # User schema
│   │   └── Message.js    # Message schema
│   ├── routes/
│   │   └── auth.js       # Auth API routes
│   └── middleware/
│       └── auth.js       # JWT middleware
├── .env                  # Environment variables
├── package.json
└── README.md
````

---

## 🚀 Run Locally

### 1. Clone the repo

```bash
git clone https://github.com/mahalakshmi-005/AuraTalk.git
cd AuraTalk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

### 4. Start the server

```bash
node server/index.js
```

### 5. Open in browser

```bash
http://localhost:5000
```

---

## 🔑 Environment Variables

| Variable      | Description                     |
| ------------- | ------------------------------- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET`  | Secret key for JWT tokens       |
| `PORT`        | Server port (default: 5000)     |

---

## 📸 Screenshots

> Login page with glassmorphism UI, real-time chat with seen ticks, mobile responsive layout.

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/6cece65b-9728-4de9-bc22-4cd32c2dc3c9" />

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/6b8be2c6-3553-4537-8912-6445ae9ac79c" />

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/b1199b6b-50f3-45e8-984c-509005e82e16" />

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/882d445f-047d-4120-a321-19762877da88" />

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/a6a97670-158d-46c6-a026-605ed5a2488c" />

---

## 👩‍💻 Author

**Mahalakshmi K**
Frontend Developer | UI/UX Enthusiast | Full Stack Developer

* 💼 LinkedIn: https://www.linkedin.com/in/maha-lakshmi-k-96682a36b/
* 💻 GitHub: https://github.com/mahalakshmi-005
* 📧 Email: [mahalakshmidd744@gmail.com](mailto:mahalakshmidd744@gmail.com

---

## 📬 Contact

For collaborations, internships, freelance work, or project opportunities:

* 📧 Email: [mahalakshmidd744@gmail.com](mailto:mahalakshmidd744@gmail.com)
* 💼 LinkedIn: https://www.linkedin.com/in/maha-lakshmi-k-96682a36b/
* 💻 GitHub Portfolio: https://github.com/mahalakshmi-005

---

<div align="center">
  Made with ❤️ by Mahalakshmi K | Full Stack Developer
</div>
```
