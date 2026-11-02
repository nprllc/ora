/*
 * Ora — moteur du calendrier liturgique (rite romain, forme ordinaire).
 * Fonctionne hors ligne, sans dépendance. Les fêtes à date fixe viennent de data/fetes.json.
 *
 * Régions (réglage distinct de la langue) :
 *  - 'fr' France : Épiphanie le dimanche entre le 2 et le 8 janvier, Ascension le jeudi, Saint-Sacrement le dimanche ;
 *  - 'es' Espagne : Épiphanie le 6 janvier, Ascension et Corpus Christi reportés au dimanche (Conférence épiscopale espagnole) ;
 *  - 'us' États-Unis : Épiphanie le dimanche, Ascension reportée au 7e dimanche de Pâques (règle de la majorité des provinces), Corpus Christi le dimanche.
 * Les fêtes propres d'une région sont dans data/fetes.json, avec un champ « regions ».
 *
 * Chaque jour reçoit aussi des « clés liturgiques » (par exemple 'to-dim-32', 'to-31-2', 'toussaint'),
 * qui servent à ranger le lectionnaire et les contenus sans aucune date civile.
 */
(function (global) {
  'use strict';

  var JOUR = 86400000;
  var REGIONS = {
    fr: { epiphanieDimanche: true, ascensionDimanche: false },
    es: { epiphanieDimanche: false, ascensionDimanche: true },
    us: { epiphanieDimanche: true, ascensionDimanche: true }
  };
  var REG = REGIONS.fr, REG_ID = 'fr';
  function region(code) { REG_ID = REGIONS[code] ? code : 'fr'; REG = REGIONS[REG_ID]; }
  // Libellés en trois langues. La langue est fixée par langue(code) ; le calcul, lui, ne change pas.
  var L = 'fr';
  var JOURS_L = {
    fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };
  var MOIS_L = {
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  var JOURS = JOURS_L.fr, MOIS = MOIS_L.fr;
  var ROMAINS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV'];
  var EN_ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
  function enOrd(n) { if (n <= 20) return EN_ORD[n]; var d = ['', '', 'Twenty', 'Thirty'][Math.floor(n / 10)]; return n % 10 ? d + '-' + EN_ORD[n % 10].toLowerCase() : (n === 30 ? 'Thirtieth' : 'Twentieth'); }
  function langue(code) { L = JOURS_L[code] ? code : 'fr'; JOURS = JOURS_L[L]; MOIS = MOIS_L[L]; }

  // Toutes les dates sont manipulées en UTC à minuit pour éviter les pièges des changements d'heure.
  function d(y, m, j) { return Date.UTC(y, m - 1, j); }
  function plus(t, n) { return t + n * JOUR; }
  function jourSemaine(t) { return new Date(t).getUTCDay(); }
  function dimancheAvantOuEgal(t) { return plus(t, -jourSemaine(t)); }
  function ecart(a, b) { return Math.round((b - a) / JOUR); }
  function cle(t) { var x = new Date(t); return pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ordinal(n) { return n === 1 ? '1er' : n + 'e'; }
  function ordinalF(n) { return n === 1 ? '1re' : n + 'e'; }

  // Date de Pâques (calendrier grégorien), algorithme de Meeus / Jones / Butcher.
  function paques(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return d(y, mois, jour);
  }

  // 1er dimanche de l'Avent : le 4e dimanche avant Noël.
  function avent(y) { var noel = d(y, 12, 25); return plus(dimancheAvantOuEgal(plus(noel, -1)), -21); }

  function epiphanie(y) { // le 6 janvier, ou le dimanche entre le 2 et le 8 janvier selon la région
    if (!REG.epiphanieDimanche) return d(y, 1, 6);
    var t = d(y, 1, 2); return plus(t, (7 - jourSemaine(t)) % 7);
  }
  function bapteme(y) {
    var ep = epiphanie(y);
    if (!REG.epiphanieDimanche) return plus(ep, 7 - jourSemaine(ep)); // le dimanche qui suit le 6 janvier
    return new Date(ep).getUTCDate() >= 7 ? plus(ep, 1) : plus(ep, 7);
  }
  function sainteFamille(y) {
    for (var j = 26; j <= 31; j++) { if (jourSemaine(d(y, 12, j)) === 0) return d(y, 12, j); }
    return d(y, 12, 30);
  }

  // Repères de l'année civile y.
  function reperes(y) {
    var p = paques(y);
    return {
      paques: p, cendres: plus(p, -46), rameaux: plus(p, -7), jeudiSaint: plus(p, -3),
      vendrediSaint: plus(p, -2), samediSaint: plus(p, -1), misericorde: plus(p, 7),
      ascension: plus(p, REG.ascensionDimanche ? 42 : 39), pentecote: plus(p, 49), marieEglise: plus(p, 50),
      trinite: plus(p, 56), saintSacrement: plus(p, 63), sacreCoeur: plus(p, 68), coeurMarie: plus(p, 69),
      avent: avent(y), christRoi: plus(avent(y), -7), epiphanie: epiphanie(y), bapteme: bapteme(y),
      sainteFamille: sainteFamille(y)
    };
  }

  var NOMS_MOBILES = {
    es: { epiphanie: 'Epifanía del Señor', bapteme: 'Bautismo del Señor', cendres: 'Miércoles de Ceniza', rameaux: 'Domingo de Ramos en la Pasión del Señor',
      'jeudi-saint': 'Jueves Santo', 'vendredi-saint': 'Viernes Santo', 'samedi-saint': 'Sábado Santo', paques: 'Domingo de Pascua de la Resurrección del Señor',
      misericorde: 'Domingo II de Pascua o de la Divina Misericordia', ascension: 'Ascensión del Señor', pentecote: 'Domingo de Pentecostés',
      'marie-mere-eglise': 'Bienaventurada Virgen María, Madre de la Iglesia', trinite: 'Santísima Trinidad', 'saint-sacrement': 'Santísimo Cuerpo y Sangre de Cristo',
      'sacre-coeur': 'Sagrado Corazón de Jesús', 'coeur-marie': 'Inmaculado Corazón de la Bienaventurada Virgen María', 'christ-roi': 'Nuestro Señor Jesucristo, Rey del Universo',
      'sainte-famille': 'La Sagrada Familia de Jesús, María y José' },
    en: { epiphanie: 'The Epiphany of the Lord', bapteme: 'The Baptism of the Lord', cendres: 'Ash Wednesday', rameaux: 'Palm Sunday of the Passion of the Lord',
      'jeudi-saint': 'Holy Thursday', 'vendredi-saint': 'Good Friday', 'samedi-saint': 'Holy Saturday', paques: 'Easter Sunday of the Resurrection of the Lord',
      misericorde: 'Second Sunday of Easter (Divine Mercy Sunday)', ascension: 'The Ascension of the Lord', pentecote: 'Pentecost Sunday',
      'marie-mere-eglise': 'The Blessed Virgin Mary, Mother of the Church', trinite: 'The Most Holy Trinity', 'saint-sacrement': 'The Most Holy Body and Blood of Christ',
      'sacre-coeur': 'The Most Sacred Heart of Jesus', 'coeur-marie': 'The Immaculate Heart of the Blessed Virgin Mary', 'christ-roi': 'Our Lord Jesus Christ, King of the Universe',
      'sainte-famille': 'The Holy Family of Jesus, Mary and Joseph' }
  };
  function nomFete(id, nomFr, f) {
    if (L === 'fr') return nomFr;
    if (f && f['nom_' + L]) return f['nom_' + L];
    return (NOMS_MOBILES[L] && NOMS_MOBILES[L][id]) || nomFr;
  }

  function mobiles(r) {
    return [
      { t: r.epiphanie, id: 'epiphanie', nom: 'Épiphanie du Seigneur', rang: 'solennite', couleur: 'blanc' },
      { t: r.bapteme, id: 'bapteme', nom: 'Baptême du Seigneur', rang: 'fete-seigneur', couleur: 'blanc' },
      { t: r.cendres, id: 'cendres', nom: 'Mercredi des Cendres', rang: 'majeur', couleur: 'violet' },
      { t: r.rameaux, id: 'rameaux', nom: 'Dimanche des Rameaux et de la Passion', rang: 'majeur', couleur: 'rouge' },
      { t: r.jeudiSaint, id: 'jeudi-saint', nom: 'Jeudi saint', rang: 'majeur', couleur: 'blanc' },
      { t: r.vendrediSaint, id: 'vendredi-saint', nom: 'Vendredi saint', rang: 'majeur', couleur: 'rouge' },
      { t: r.samediSaint, id: 'samedi-saint', nom: 'Samedi saint', rang: 'majeur', couleur: 'violet' },
      { t: r.paques, id: 'paques', nom: 'Dimanche de Pâques', rang: 'majeur', couleur: 'blanc' },
      { t: r.misericorde, id: 'misericorde', nom: '2e dimanche de Pâques, de la Divine Miséricorde', rang: 'majeur', couleur: 'blanc' },
      { t: r.ascension, id: 'ascension', nom: 'Ascension du Seigneur', rang: 'solennite', couleur: 'blanc' },
      { t: r.pentecote, id: 'pentecote', nom: 'Pentecôte', rang: 'majeur', couleur: 'rouge' },
      { t: r.marieEglise, id: 'marie-mere-eglise', nom: 'Bienheureuse Vierge Marie, Mère de l\'Église', rang: 'memoire', couleur: 'blanc' },
      { t: r.trinite, id: 'trinite', nom: 'La Sainte Trinité', rang: 'solennite', couleur: 'blanc' },
      { t: r.saintSacrement, id: 'saint-sacrement', nom: 'Le Saint-Sacrement du Corps et du Sang du Christ', rang: 'solennite', couleur: 'blanc' },
      { t: r.sacreCoeur, id: 'sacre-coeur', nom: 'Sacré-Cœur de Jésus', rang: 'solennite', couleur: 'blanc' },
      { t: r.coeurMarie, id: 'coeur-marie', nom: 'Cœur immaculé de Marie', rang: 'memoire', couleur: 'blanc' },
      { t: r.christRoi, id: 'christ-roi', nom: 'Notre Seigneur Jésus Christ, Roi de l\'univers', rang: 'solennite', couleur: 'blanc' },
      { t: r.sainteFamille, id: 'sainte-famille', nom: 'La Sainte Famille de Jésus, Marie et Joseph', rang: 'fete-seigneur', couleur: 'blanc' }
    ].map(function (m) { m.nom = nomFete(m.id, m.nom); return m; });
  }

  // Temps liturgique d'une date.
  function saison(t, r, rPrec) {
    var y = new Date(t).getUTCFullYear();
    if (t <= r.bapteme || t >= d(y, 12, 25)) return 'noel';
    if (t < r.cendres) return 'ordinaire';
    if (t < r.jeudiSaint) return 'careme';
    if (t < r.paques) return 'triduum';
    if (t <= r.pentecote) return 'paques';
    if (t < r.avent) return 'ordinaire';
    return 'avent';
  }

  var NOMS_SAISON_L = {
    fr: { avent: 'Temps de l\'Avent', noel: 'Temps de Noël', ordinaire: 'Temps ordinaire', careme: 'Temps du Carême', triduum: 'Triduum pascal', paques: 'Temps pascal' },
    es: { avent: 'Tiempo de Adviento', noel: 'Tiempo de Navidad', ordinaire: 'Tiempo Ordinario', careme: 'Tiempo de Cuaresma', triduum: 'Triduo Pascual', paques: 'Tiempo de Pascua' },
    en: { avent: 'Advent', noel: 'Christmas Time', ordinaire: 'Ordinary Time', careme: 'Lent', triduum: 'Easter Triduum', paques: 'Easter Time' }
  };
  var COULEUR_SAISON = { avent: 'violet', noel: 'blanc', ordinaire: 'vert', careme: 'violet', triduum: 'rouge', paques: 'blanc' };

  // Jours « de premier rang » : aucune solennité ni fête ne peut s'y célébrer.
  function premierRang(t, r) {
    var s = saison(t, r), dim = jourSemaine(t) === 0;
    if (t === r.cendres) return true;
    if (t >= r.rameaux && t <= plus(r.paques, 7)) return true; // Semaine sainte et octave de Pâques
    if (dim && (s === 'avent' || s === 'careme' || s === 'paques')) return true;
    if (t === r.pentecote) return true;
    return false;
  }

  // Date effective des solennités qui peuvent être déplacées.
  function dateEffective(f, y, r) {
    var t = d(y, +f.date.slice(0, 2), +f.date.slice(3));
    if (f.id === 'joseph') {
      if (t >= r.rameaux && t <= r.paques) return plus(r.rameaux, -1);
      if (premierRang(t, r)) return plus(t, 1);
    }
    if (f.id === 'annonciation') {
      if (t >= r.rameaux && t <= plus(r.paques, 7)) return plus(r.paques, 8);
      if (premierRang(t, r)) return plus(t, 1);
    }
    if (f.id === 'immaculee-conception' && jourSemaine(t) === 0) return plus(t, 1);
    if (f.id === 'nativite-jean-baptiste' && t === r.sacreCoeur) return plus(t, -1);
    return t;
  }

  var POIDS = { majeur: 100, solennite: 90, commemoration: 85, 'fete-seigneur': 80, dimanche: 70, fete: 60, memoire: 30 };

  // Libellé du jour en espagnol et en anglais (le français est calculé plus bas).
  function libelleAutre(t, s, r, n, info) {
    var js = jourSemaine(t), dim = js === 0, J = JOURS[js], x = new Date(t), es = L === 'es';
    var T = es ? { avent: 'de Adviento', ordinaire: 'del tiempo ordinario', careme: 'de Cuaresma', paques: 'de Pascua' }
               : { avent: 'of Advent', ordinaire: 'in Ordinary Time', careme: 'of Lent', paques: 'of Easter' };
    var semaine = function (k) {
      if (es) return dim ? 'Domingo ' + ROMAINS[n] + ' ' + T[k] : J + ' de la ' + ROMAINS[n] + ' semana ' + T[k];
      return dim ? enOrd(n) + ' Sunday ' + T[k] : J + ' of the ' + enOrd(n) + ' Week ' + T[k];
    };
    if (info === 'avent-fin') return es ? 'Feria de Adviento: ' + x.getUTCDate() + ' de diciembre' : 'December ' + x.getUTCDate() + ', Advent weekday';
    if (info === 'octave-noel') return es ? J + ' de la octava de Navidad' : J + ' within the Octave of Christmas';
    if (info === 'noel') return es ? J + ' del tiempo de Navidad' : J + ' of Christmas Time';
    if (info === 'apres-cendres') return es ? J + ' después de Ceniza' : J + ' after Ash Wednesday';
    if (info === 'saint') return es ? J + ' Santo' : (js === 5 ? 'Good Friday' : js === 4 ? 'Holy Thursday' : js === 6 ? 'Holy Saturday' : J + ' of Holy Week');
    if (info === 'octave-paques') return es ? J + ' de la octava de Pascua' : J + ' within the Octave of Easter';
    return semaine(s);
  }

  function semaineEtLibelle(t, s, r) {
    var res = semaineEtLibelleFr(t, s, r);
    if (L !== 'fr') res.libelle = libelleAutre(t, s, r, res.semaine, res.info);
    return res;
  }

  function semaineEtLibelleFr(t, s, r) {
    var y = new Date(t).getUTCFullYear(), js = jourSemaine(t), dim = js === 0, n = null, lib, info = null;
    if (s === 'avent') {
      n = Math.floor(ecart(r.avent, t) / 7) + 1;
      if (t >= d(y, 12, 17) && !dim) { lib = JOURS[js] + ' ' + new Date(t).getUTCDate() + ' décembre, temps de l\'Avent'; info = 'avent-fin'; }
      else lib = dim ? ordinal(n) + ' dimanche de l\'Avent' + (n === 3 ? ' (Gaudete)' : '') : JOURS[js] + ' de la ' + ordinalF(n) + ' semaine de l\'Avent';
    } else if (s === 'noel') {
      var dj = new Date(t).getUTCDate(), mo = new Date(t).getUTCMonth();
      if (mo === 11 || (mo === 0 && dj === 1)) { lib = JOURS[js] + ' dans l\'octave de Noël'; info = 'octave-noel'; }
      else { lib = JOURS[js] + ' du temps de Noël'; info = 'noel'; }
    } else if (s === 'ordinaire') {
      if (t < r.cendres) {
        var depart = jourSemaine(r.bapteme) === 0 ? r.bapteme : plus(r.bapteme, -1);
        n = Math.floor(ecart(depart, t) / 7) + 1;
      } else {
        n = 34 - Math.floor(ecart(dimancheAvantOuEgal(t), r.christRoi) / 7);
      }
      lib = dim ? ordinal(n) + ' dimanche du temps ordinaire' : JOURS[js] + ' de la ' + ordinalF(n) + ' semaine du temps ordinaire';
    } else if (s === 'careme') {
      var premier = plus(r.cendres, 4);
      if (t < premier) { lib = JOURS[js] + ' après les Cendres'; info = 'apres-cendres'; }
      else {
        n = Math.floor(ecart(premier, t) / 7) + 1;
        if (t >= r.rameaux) { lib = JOURS[js] + ' saint'; info = 'saint'; }
        else lib = dim ? ordinal(n) + ' dimanche de Carême' + (n === 4 ? ' (Laetare)' : '') : JOURS[js] + ' de la ' + ordinalF(n) + ' semaine de Carême';
      }
    } else if (s === 'triduum') {
      lib = JOURS[js] + ' saint'; info = 'saint';
    } else {
      n = Math.floor(ecart(r.paques, t) / 7) + 1;
      if (t < plus(r.paques, 7)) { lib = JOURS[js] + ' dans l\'octave de Pâques'; info = 'octave-paques'; }
      else lib = dim ? ordinal(n) + ' dimanche de Pâques' : JOURS[js] + ' de la ' + ordinalF(n) + ' semaine de Pâques';
    }
    return { semaine: n, libelle: lib, info: info };
  }

  function couleurDuJour(t, s, r, sem) {
    var dim = jourSemaine(t) === 0;
    if (dim && s === 'avent' && sem === 3) return 'rose';
    if (dim && s === 'careme' && sem === 4 && t < r.rameaux) return 'rose';
    if (s === 'careme' && t >= r.rameaux) return t === r.rameaux ? 'rouge' : 'violet';
    if (t === r.pentecote) return 'rouge';
    return COULEUR_SAISON[s];
  }

  /**
   * Renvoie la description liturgique d'une date.
   * @param {Date|string} date  une date (Date) ou une chaîne 'AAAA-MM-JJ'
   * @param {{fixes:Array}} donnees  le contenu de data/fetes.json
   */
  function jour(date, donnees) {
    var t;
    if (typeof date === 'string') { var p = date.split('-'); t = d(+p[0], +p[1], +p[2]); }
    else t = d(date.getFullYear(), date.getMonth() + 1, date.getDate());
    var y = new Date(t).getUTCFullYear(), r = reperes(y);
    var s = saison(t, r), sl = semaineEtLibelle(t, s, r), dim = jourSemaine(t) === 0;

    // Candidats du jour.
    var cands = [];
    mobiles(r).forEach(function (m) { if (m.t === t) cands.push(m); });
    if (y > 1900) { // la Sainte Famille et le Christ-Roi de l'année précédente ne peuvent pas tomber ici
      (donnees && donnees.fixes || []).forEach(function (f) {
        if (f.regions && f.regions.indexOf(REG_ID) < 0) return;
        if (dateEffective(f, y, r) === t) cands.push({ t: t, id: f.id, nom: nomFete(f.id, f.nom, f), rang: f.rang, couleur: f.couleur });
      });
    }
    var pr = premierRang(t, r);
    cands = cands.filter(function (c) {
      if (c.rang === 'majeur') return true;
      if (pr) return c.rang === 'solennite' && (c.id === 'epiphanie' || c.id === 'ascension' || c.id === 'trinite');
      if (dim && c.rang === 'fete') return false;
      if (dim && c.rang === 'memoire') return false;
      if ((s === 'careme' || s === 'avent' && t >= d(y, 12, 17)) && c.rang === 'memoire') return false;
      return true;
    });
    cands.sort(function (a, b) { return POIDS[b.rang] - POIDS[a.rang]; });
    var celebration = cands[0] || null;
    if (celebration && celebration.rang === 'fete-seigneur' && dim) celebration.remplaceDimanche = true;

    var litY = t >= r.avent ? y + 1 : y;
    var cycle = ['C', 'A', 'B'][litY % 3];
    var semaineCouleur = couleurDuJour(t, s, r, sl.semaine);
    var couleur = celebration && celebration.rang !== 'memoire' ? celebration.couleur : semaineCouleur;
    if (celebration && celebration.rang === 'memoire') couleur = celebration.couleur;
    var x = new Date(t);
    var parite = litY % 2 === 1 ? 'I' : 'II';
    var cles = clesDuJour(t, s, sl, r, celebration, cycle, parite);

    return {
      cles: cles,
      region: REG_ID,
      indexAnnee: ecart(t >= r.avent ? r.avent : avent(y - 1), t),
      date: x.getUTCFullYear() + '-' + cle(t),
      dateLongue: L === 'es' ? JOURS[x.getUTCDay()] + ', ' + x.getUTCDate() + ' de ' + MOIS[x.getUTCMonth()] + ' de ' + x.getUTCFullYear()
        : L === 'en' ? JOURS[x.getUTCDay()] + ', ' + MOIS[x.getUTCMonth()] + ' ' + x.getUTCDate() + ', ' + x.getUTCFullYear()
        : JOURS[x.getUTCDay()] + ' ' + (x.getUTCDate() === 1 ? '1er' : x.getUTCDate()) + ' ' + MOIS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(),
      jourSemaine: JOURS[x.getUTCDay()],
      saison: { id: s, nom: NOMS_SAISON_L[L][s] },
      semaine: sl.semaine,
      libelleDuJour: sl.libelle,
      celebration: celebration ? { id: celebration.id, nom: celebration.nom, rang: celebration.rang, couleur: celebration.couleur } : null,
      titre: celebration && celebration.rang !== 'memoire' ? celebration.nom : sl.libelle,
      couleur: couleur,
      anneeDominicale: cycle,
      anneeFeriale: litY % 2 === 1 ? 'I' : 'II',
      dimanche: dim
    };
  }

  // Clé du jour « férial » (sans la célébration), selon le temps liturgique.
  function cleFeriale(t, s, sl, r) {
    var y = new Date(t).getUTCFullYear(), js = jourSemaine(t), dim = js === 0, x = new Date(t);
    var mmjj = pad(x.getUTCMonth() + 1) + pad(x.getUTCDate());
    if (s === 'avent') {
      if (dim) return 'avent-dim-' + sl.semaine;
      return t >= d(y, 12, 17) ? 'avent-' + mmjj : 'avent-' + sl.semaine + '-' + js;
    }
    if (s === 'noel') {
      if (x.getUTCMonth() === 11 || mmjj === '0101') return 'noel-' + mmjj;
      var ep = epiphanie(y);
      if (t > ep) return 'noel-apres-epiphanie-' + ecart(ep, t);
      return dim ? 'noel-dim-2' : 'noel-' + mmjj;
    }
    if (s === 'ordinaire') return dim ? 'to-dim-' + sl.semaine : 'to-' + sl.semaine + '-' + js;
    if (s === 'careme') {
      if (sl.info === 'apres-cendres') return 'cendres-' + js;
      if (sl.info === 'saint') return 'semaine-sainte-' + js;
      return dim ? 'careme-dim-' + sl.semaine : 'careme-' + sl.semaine + '-' + js;
    }
    if (s === 'triduum') return 'semaine-sainte-' + js;
    if (sl.info === 'octave-paques') return 'octave-paques-' + js;
    return dim ? 'paques-dim-' + sl.semaine : 'paques-' + sl.semaine + '-' + js;
  }

  // Clés à chercher, de la plus précise à la plus générale :
  // la célébration (avec son cycle ou sa parité), puis le jour férial (avec son cycle ou sa parité).
  function clesDuJour(t, s, sl, r, celebration, cycle, parite) {
    var out = [], ajoute = function (k) { out.push(k + '-' + cycle, k + '-' + parite, k); };
    if (celebration) ajoute(celebration.id);
    ajoute(cleFeriale(t, s, sl, r));
    return out;
  }

  var api = { langue: langue, region: region, regions: Object.keys(REGIONS), cleFeriale: function (date) { var j = jour(date); return j.cles[j.cles.length - 1]; }, jour: jour, paques: function (y) { var x = new Date(paques(y)); return x.getUTCFullYear() + '-' + cle(paques(y)); }, reperes: reperes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.OraLiturgie = api;
})(this);
