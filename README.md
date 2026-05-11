````md
# 💬 AuraTalk

> Real-time full-stack chat application built with Node.js, Socket.io & MongoDB.

<p align="center">
  <img src="https://img.shields.io/badge/AuraTalk-v3.0.0-25d366?style=for-the-badge&logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/Hosted-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" />
</p>

---

## 🌐 Live Demo

<p align="center">
  <a href="https://auratalk-7fkw.onrender.com">
    <strong>🚀 Visit AuraTalk Live</strong>
  </a>
</p>

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
|------|------------|
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Real-time** | Socket.io |
| **Database** | MongoDB Atlas + Mongoose |
| **Authentication** | JWT + bcryptjs |
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
│
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── models/
│   │   ├── User.js       # User schema
│   │   └── Message.js    # Message schema
│   ├── routes/
│   │   └── auth.js       # Auth API routes
│   └── middleware/
│       └── auth.js       # JWT middleware
│
├── .env                  # Environment variables
├── package.json
└── README.md
````

---

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/mahalakshmi-005/AuraTalk.git
cd AuraTalk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

### 4. Start the application

```bash
node server/index.js
```

### 5. Access in browser

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

> Modern glassmorphism UI, real-time messaging, mobile responsive design, and full chat features.

<p align="center">
  <img width="800" src="https://github.com/user-attachments/assets/6cece65b-9728-4de9-bc22-4cd32c2dc3c9" />
</p>

<p align="center">
  <img width="800" src="https://github.com/user-attachments/assets/6b8be2c6-3553-4537-8912-6445ae9ac79c" />
</p>

<p align="center">
  <img width="800" src="https://github.com/user-attachments/assets/b1199b6b-50f3-45e8-984c-509005e82e16" />
</p>

<p align="center">
  <img width="800" src="https://github.com/user-attachments/assets/882d445f-047d-4120-a321-19762877da88" />
</p>

<p align="center">
  <img width="800" src="https://github.com/user-attachments/assets/a6a97670-158d-46c6-a026-605ed5a2488c" />
</p>

---

## 👩‍💻 Author

### **Mahalakshmi K**

**Frontend Developer | UI/UX Enthusiast | Full Stack Developer**

* 💼 **LinkedIn:** https://www.linkedin.com/in/maha-lakshmi-k-96682a36b/
* 💻 **GitHub:** https://github.com/mahalakshmi-005
* 📧 **Email:** [mahalakshmidd744@gmail.com](mailto:mahalakshmidd744@gmail.com)

---

## 📬 Contact

For internships, freelance work, collaborations, or professional opportunities:

* 📧 **Email:** [mahalakshmidd744@gmail.com](mailto:mahalakshmidd744@gmail.com)
* 💼 **LinkedIn:** https://www.linkedin.com/in/maha-lakshmi-k-96682a36b/
* 💻 **Portfolio / GitHub:** https://github.com/mahalakshmi-005

---

## 📄 License

This project is open source and available under the **MIT License**.

---

<p align="center">
  Made with ❤️ by <strong>Mahalakshmi K</strong> | Full Stack Developer
</p>
```
