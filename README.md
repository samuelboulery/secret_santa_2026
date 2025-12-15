# Secret Santa 2026 - Hello World app

Petite appli web **très simple** pour tester le push sur Cursor / Git et le déploiement sur **Netlify**.

Elle contient une page statique avec un "Hello world" et un bouton qui affiche un petit message.

## Contenu

- `index.html` : page principale
- `style.css` : styles (mise en page simple et moderne)
- `main.js` : un peu de JS pour le bouton

## Lancer en local

Tu peux simplement ouvrir `index.html` dans ton navigateur :

1. Ouvre le dossier du projet dans le Finder
2. Double-clique sur `index.html`

Ou avec un petit serveur local (optionnel, mais plus proche d’un vrai hébergement) :

```bash
cd /Users/sam/secret_santa_2026
python3 -m http.server 4173
```

Ensuite va sur `http://localhost:4173` dans ton navigateur.

## Déployer sur Netlify

1. Pousse ce projet sur un repo GitHub / GitLab / Bitbucket
2. Va sur [`https://app.netlify.com`](https://app.netlify.com)
3. Clique sur **"Add new site"** → **"Import an existing project"**
4. Choisis ton repo
5. Dans la config Netlify :
   - **Build command** : (laisse vide, car c’est un site statique pur)
   - **Publish directory** : `/` ou laisse vide (Netlify prendra la racine avec `index.html`)
6. Lance le déploiement

Netlify va te donner une URL du style `https://mon-site-quelquechose.netlify.app` pour partager ton Hello World.


