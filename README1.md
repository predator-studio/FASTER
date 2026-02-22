# Faster

Parashikim trafiku për Shqipëri · Matematika që modelon dhe përmirëson trafikun në jetën tonë të përditshme.

## Struktura

```
faster/
├── backend/          # Flask API + logjika trafiku
│   ├── app.py
│   ├── requirements.txt
│   └── README.md
├── frontend/         # HTML, CSS, JS (funksionon pa backend)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── README.md
└── README.md
```

## Si ta përdorësh

### Vetëm frontend (pa backend)

1. Hap `frontend/index.html` në shfletues, **ose**
2. `cd frontend && python -m http.server 8080` → http://localhost:8080

### Me backend

1. `cd backend`
2. `pip install -r requirements.txt`
3. `python app.py`
4. Hap http://localhost:5000
