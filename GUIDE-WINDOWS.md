# Gestion table tournante Libre sous Windows

Ce guide dit comment obtenir le logiciel, le lancer, où il range vos
événements, comment les sauvegarder, quoi faire si un antivirus le bloque, où
lire sa version et comment signaler un problème. Le déroulement d’une soirée,
de la liste des participants à l’impression, est dans `GUIDE-USAGE.md`.

Ce guide n’a pas d’images : les écrans qu’il décrit sont ceux de Windows, et les
captures du guide d’usage sont prises ailleurs.

## Obtenir l’exécutable

Le logiciel tient en **un seul fichier**, un exécutable portable : il n’y a
rien à installer, et il ne demande aucun droit d’administrateur. Il fonctionne
sans connexion à Internet.

Vous le recevez de la personne ou de l’organisme qui vous le fournit, sur une
clé, par courriel ou dans un dossier partagé. Son nom suit le gabarit
`gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe` : `<AAAA>`, `<MM>` et
`<JJ>` sont l’année, le mois et le jour de la version, `<NN>` son rang dans la
journée. Cherchez donc le fichier dont le nom commence par
`gestion_table_tournante_libre_v` ; ce qui suit change à chaque version, et le
nom ne porte qu’un seul point, celui de `.exe`.

Rangez l’exécutable dans le dossier où vous voulez garder vos événements, par
exemple un dossier à vous sur le disque ou sur une clé USB : le logiciel
essaie d’écrire à côté de lui (voir « Le dossier de travail »). Évitez de le
lancer directement depuis une pièce jointe ou depuis une archive ouverte sans
l’extraire : Windows le place alors dans un dossier temporaire, et vos
événements iraient dans vos Documents.

**Passer à une version plus récente.** Lisez d’abord, dans `CHANGELOG.md`, ce
que la nouvelle version change et ce qu’il faut faire en remplaçant. Posez le
nouvel exécutable dans le même dossier que l’ancien : il retrouve le même
dossier de travail et les mêmes événements. Gardez l’ancien tant que la
nouvelle version n’a pas fait ses preuves. Un fichier écrit par une version
plus ancienne s’ouvre normalement, et le bandeau annonce qu’il se convertira à
votre première modification ; un fichier écrit par une version plus récente
s’ouvre en lecture seule.

## Le lancer

Double-cliquez sur l’exécutable. Le démarrage prend quelques secondes : le
fichier se décompresse à chaque lancement. Au tout premier lancement, Windows
peut afficher un avertissement ; la section « Si l’antivirus bloque » dit
comment passer.

La fenêtre s’ouvre sur la **liste des événements**. Elle affiche en clair le
dossier de travail de la séance, sous « Dossier de travail ». Quand aucun
événement n’existe encore, elle offre de créer un événement et de charger l’une
des démonstrations.

Un événement s’ouvre toujours **en lecture** : rien ne peut le modifier par
mégarde. La commande « Modifier », toujours à la même place, passe en
écriture ; après un moment d’inactivité, le logiciel revient seul en lecture.

Pour quitter, fermez la fenêtre. Il n’y a rien à enregistrer : chaque geste
achevé est déjà sur le disque.

## Le dossier de travail

À chaque lancement, le logiciel choisit son dossier de travail par une règle
fixe, puis l’affiche sur la liste des événements. La règle a **deux issues** :

1. **Le mode portable : le dossier `data` à côté de l’exécutable.** Le logiciel
   crée au besoin un dossier `data` dans le dossier de l’exécutable, puis
   vérifie qu’il peut y écrire et relire un fichier. S’il le peut, c’est son
   dossier de travail : l’exécutable et vos événements voyagent ensemble, et
   copier ce dossier suffit à tout emporter.
2. **Sinon, un dossier dans vos Documents :
   `Documents\Gestion table tournante Libre`.** Le logiciel le crée et dit
   pourquoi, une fois par lancement, sans rien bloquer. Les raisons possibles :
   le dossier de l’exécutable n’est pas connu ; l’exécutable est rangé sous
   les données applicatives de Windows ou dans un dossier temporaire ; ou le
   dossier `data` refuse l’écriture — une clé verrouillée en lecture seule, un
   dossier protégé comme celui des programmes, un antivirus.

Le logiciel ne range jamais vos événements dans un dossier caché.

**La commande « Ouvrir dans l’explorateur »**, sous le chemin affiché sur la
liste des événements, ouvre le dossier de travail dans l’Explorateur de
fichiers.

Ce qui arrive ensuite est réglé aussi :

- si le dossier `data` contient des événements mais refuse l’écriture, le
  logiciel ne bascule pas en silence vers les Documents. Il nomme le dossier,
  dit ce qui l’empêche, et vous laisse choisir : « Réessayer », « Travailler
  dans les Documents, en y copiant ces événements », ou « Continuer : ouvrir la
  liste, aucun geste ne s’y enregistrera » ;
- si le dossier de travail est neuf et vide alors que l’autre emplacement
  contient des événements, le logiciel le dit et propose « Importer ces
  événements ». L’import les copie : les originaux restent où ils sont ;
- si une écriture échoue en cours de séance, par exemple quand la clé est
  retirée, le logiciel nomme le fichier et le dossier, et propose d’écrire
  ailleurs. Tant que ce n’est pas fait, le dernier geste n’est pas sur le
  disque, et le logiciel le dit ;
- sur une clé ou un disque amovible, le mode portable protège moins bien
  contre une coupure pendant une écriture ; le logiciel l’annonce.

**Ce que contient le dossier.** Chaque événement y tient en deux fichiers
ordinaires, nommés d’après lui : `<nom>.gtt.json`, son état complet, et
`<nom>.gtt-journal.jsonl`, son historique. Les deux portent le même identifiant
interne, et c’est lui qui les apparie, pas leur nom ; renommez un événement par
la commande « Renommer » de la liste plutôt que dans l’explorateur. Le dossier
`corbeille` reçoit les événements supprimés, chacun dans un dossier daté ; le
logiciel ne la vide jamais. Le fichier `reglages_locaux.json` garde les réglages
de ce poste, comme le format de papier. Les planches de badges produites se
déposent à côté des fichiers de l’événement.

## Sauvegarder

Ouvrez le dossier de travail par « Ouvrir dans l’explorateur », puis copiez-le
en entier sur une clé, un autre disque ou un dossier sauvegardé. En mode
portable, copiez le dossier qui contient l’exécutable et son dossier `data`.
Faites la copie logiciel fermé : aucun fichier n’est alors en cours
d’écriture.

Pour envoyer un seul événement, joignez ses deux fichiers, `<nom>.gtt.json` et
`<nom>.gtt-journal.jsonl`. Pour le reprendre, déposez-les dans le dossier de
travail, ou utilisez « Importer un événement depuis un fichier… » sur la liste
des événements. Ces fichiers se lisent sans le logiciel : ce sont des fichiers
texte ordinaires.

Ils contiennent les noms, et parfois les courriels et les notes, des
participants : traitez-les comme toute liste de personnes, et ne les envoyez
qu’à qui doit les recevoir.

## Si l’antivirus bloque

**Au premier lancement**, Windows peut afficher « Windows a protégé votre
ordinateur » : l’exécutable est récent et peu répandu, Windows ne le connaît
pas encore. Si le fichier vient bien de la source habituelle, cliquez sur
« Informations complémentaires », puis sur « Exécuter quand même ». En cas de
doute, demandez à la personne qui vous l’a fourni avant de l’ouvrir.

**Si l’antivirus met l’exécutable en quarantaine** ou l’empêche de démarrer,
demandez à la personne qui gère votre poste de l’autoriser, ou ajoutez-le
vous-même aux exceptions de l’antivirus.

**Si l’antivirus empêche d’écrire** dans le dossier `data`, le logiciel
travaille dans vos Documents et dit pourquoi. Si la protection de Windows
nommée « Accès contrôlé aux dossiers » est active, elle peut refuser l’écriture
dans les Documents aussi : le logiciel dit alors que le dossier de travail
refuse l’écriture. Ajoutez l’exécutable aux applications autorisées de cette
protection.

**Si une écriture échoue parce qu’un fichier est occupé**, réessayez : un
antivirus ou un outil de synchronisation de fichiers garde parfois un fichier
ouvert un court instant.

## Où lire la version

La version se lit sans rien chercher :

- dans le **bandeau** en haut de chaque écran, et sur la liste des événements ;
- dans le **titre de la fenêtre**, après le nom du logiciel ;
- au **pied de chaque page imprimée** ; un badge découpé n’en porte pas ;
- dans le panneau « À propos », ouvert depuis le bandeau. Il montre un bloc
  d’une ligne — la version, la version Windows, la plateforme, la provenance de
  la construction et la version de format des fichiers — que la commande
  « Copier » met dans le presse-papiers.

Les propriétés du fichier, dans l’Explorateur, montrent la **version
Windows**, une autre écriture du même numéro : le bloc d’« À propos » porte les
deux, ce qui permet de faire le lien.

## Signaler un problème

Écrivez à la personne ou à l’organisme qui vous a fourni le logiciel, en
joignant :

1. le bloc d’« À propos », collé tel quel après « Copier » : un numéro recopié
   à la main se recopie faux ;
2. ce que vous faisiez, ce que vous attendiez, et ce qui s’est passé, avec le
   texte exact du message s’il y en a un ;
3. une capture d’écran qui montre le bandeau : il porte la version ;
4. si le problème tient à un événement précis, et seulement avec l’accord des
   personnes concernées, ses deux fichiers.

Le logiciel n’envoie rien de lui-même : il ne se connecte à aucun service.
