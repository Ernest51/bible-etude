/* ==== Rubriques longues (6–27) ==== */
/**
 * Générateur doctrinal long (≈2000–2500 caractères).
 * Structure: titre, intro (thèse), 3 axes, résonances canoniques, pastorale/pratique, prière-scellé.
 * Utilise analysis.topWords / analysis.themes pour colorer légèrement le propos.
 */
function buildLongDoctrineSection(ctx, { title, thesis, axes, canons, praxis, scelle }) {
  const { book, chapter, analysis } = ctx;
  const ref = `${book} ${chapter}`;
  const mots = (analysis?.topWords || []).slice(0, 6).join(', ');
  const themes = (analysis?.themes || []);
  const accent =
    themes.includes('grâce') ? `La **grâce** demeure l’horizon: initiative divine première, relèvement réel, espérance durable. `
  : themes.includes('loi')   ? `La **Loi** joue son rôle pédagogique: dévoiler la vérité et régler la réponse fidèle. `
  : themes.includes('alliance') ? `Le cadre d’**Alliance** structure la lecture: promesse, signe, fidélité, discipline paternelle. `
  : themes.includes('péché') ? `Le **péché** est nommé sans fard, non pour accabler mais pour conduire à la vie. `
  : themes.includes('création') ? `La **création** et la providence élargissent la perspective de ce passage. `
  : themes.includes('royaume') ? `Le **Royaume** affleure: règne de Dieu, autorité du Christ, appel à l’obéissance. `
  : `La dynamique biblique demeure: Dieu parle, l’homme répond, la vérité libère. `;

  const p = [];
  p.push(`${title}  \n*Référence :* ${ref}\n`);

  // Thèse d'ouverture
  p.push(
    `${thesis} Cette section s’inscrit dans une pédagogie divine où ${book} ${chapter} réunit des motifs ` +
    `(${mots}) pour former le discernement et conduire à l’obéissance pacifiée. ${accent}`
  );

  // Axes (3 à 4)
  if (axes && axes.length) {
    p.push('');
    p.push(`**Axes de lecture**`);
    axes.forEach((ax, i) => {
      p.push(`${i + 1}. ${ax}`);
    });
  }

  // Résonances canoniques
  if (canons && canons.length) {
    p.push('');
    p.push(
      `**Résonances canoniques** — La Bible s’explique par la Bible: proximité contextuelle (au sein du livre), ` +
      `horizons sapientiels et prophétiques, et lumière néotestamentaire en Christ (Luc 24:27; Jean 5:39).`
    );
    canons.forEach(c => p.push(`- ${c}`));
  }

  // Praxis pastorale
  if (praxis && praxis.length) {
    p.push('');
    p.push(`**Praxis / Mise en œuvre** — La doctrine n’est pas un musée: elle règle la vie ordinaire.`);
    praxis.forEach(x => p.push(`- ${x}`));
  }

  // Prière / Scellé
  p.push('');
  p.push(
    scelle ||
    `**Prière** — Seigneur, grave en nous cette vérité pour que la foi devienne obéissance humble, ` +
    `et que la charité ordonnée illumine nos œuvres. Amen.`
  );

  // Gonflage dans la plage 2000–2500
  return inflateToRange(p.join('\n'), 2000, 2500, ctx);
}

/* === Rubriques 6–27 avec contenu long === */

function buildPromesses(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Promesses**',
    thesis:
      `Les promesses de Dieu ne sont ni slogans ni vœux pieux: elles sont des **actes de parole** par lesquels Dieu ` +
      `fait exister un avenir qu’il garantit lui-même. Inscrites dans l’Alliance, elles nourrissent la patience, ` +
      `réglent l’espérance et corrigent les interprétations pressées.`,
    axes: [
      `**Promesse et serment**: Dieu lie sa fidélité à une parole fiable (Hébreux 6:13–20).`,
      `**Temps de Dieu**: délai apparent, mais exactitude souveraine (2 Pierre 3:9).`,
      `**Christ accomplissement**: en Lui le “oui” de toutes les promesses (2 Corinthiens 1:20).`,
      `**Foi et obéissance**: la promesse ne relativise pas la sainteté; elle l’enclenche.`
    ],
    canons: [
      `Genèse 12:1–3; 15 — promesse fondatrice et serment.`,
      `Psaume 89 — fidélité au pacte malgré la crise.`,
      `Luc 1–2 — promesse et visitation: l’heure venue.`,
      `Romains 4 — Abraham: modèle de foi patiente.`
    ],
    praxis: [
      `Résister au court-termisme spirituel; pratiquer l’espérance comme vertu stable.`,
      `Relire les promesses non comme échappatoire, mais comme appel à la sainteté.`,
      `Tenir ensemble consolation et exigence: la promesse soutient l’obéissance.`
    ]
  });
}

function buildPecheEtGrace(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Péché et grâce**',
    thesis:
      `Le diagnostic biblique nomme le **péché** comme révolte objective contre Dieu et déviation intérieure. ` +
      `La **grâce** n’est ni indulgence bon marché ni simple émotion: c’est l’initiative souveraine qui pardonne, ` +
      `renouvelle et intègre dans l’Alliance.`,
    axes: [
      `**Vérité du péché**: culpabilité réelle, solidarité humaine (Romains 3).`,
      `**Priorité de la grâce**: Dieu devance, appelle, relève (Éphésiens 2:1–10).`,
      `**Conversion**: repentance et foi, passage de la mort à la vie.`,
      `**Sanctification**: grâce formatrice, non permissive (Tite 2:11–14).`
    ],
    canons: [
      `Genèse 3 — chute et promesse (Protoévangile).`,
      `Psaume 51 — confession éclairée.`,
      `Romains 5–8 — Adam/Christ; vie nouvelle dans l’Esprit.`
    ],
    praxis: [
      `Pratiquer la confession régulière: vérité qui libère.`,
      `Accueillir la grâce comme puissance de transformation.`,
      `Refuser l’autojustification et le désespoir: deux faux évangiles.`
    ]
  });
}

function buildChristologie(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Christologie**',
    thesis:
      `Le Christ est **clé herméneutique** de l’Écriture et centre de l’économie du salut. Vrai Dieu et vrai homme, ` +
      `il accomplit la promesse, révèle le Père, porte le jugement et inaugure la vie nouvelle.`,
    axes: [
      `**Personne**: unité de la personne, deux natures sans confusion ni séparation.`,
      `**Œuvre**: incarnation, croix, résurrection, ascension et intercession.`,
      `**Royaume**: règne déjà inauguré, attente de la consommation.`,
      `**Union au Christ**: participation à sa mort et sa vie (Romains 6).`
    ],
    canons: [
      `Ésaïe 53 — serviteur souffrant.`,
      `Psaumes messianiques (2; 110).`,
      `Colossiens 1:15–20 — primauté cosmique.`,
      `Hébreux — Christ grand prêtre.`
    ],
    praxis: [
      `Fonder la piété sur la personne et l’œuvre du Christ, non sur l’émotion.`,
      `Vivre de l’union au Christ: identité, éthique, mission.`,
      `Adorer: la haute christologie engendre la doxologie.`
    ]
  });
}

function buildEspritSaint(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Esprit Saint**',
    thesis:
      `L’Esprit est Dieu, non une force anonyme. Il illumine l’Écriture, convainc de péché, unit au Christ, ` +
      `sanctifie et envoie. Il construit l’Église par la Parole et les sacrements, distribuant les dons pour l’édification.`,
    axes: [
      `**Révélation et illumination** (Jean 16).`,
      `**Nouvelle naissance** (Jean 3) et sanctification.`,
      `**Édification ecclésiale**: diversité des dons, unité du corps (1 Corinthiens 12–14).`,
      `**Mission**: puissance pour le témoignage (Actes 1:8).`
    ],
    canons: [
      `Joël 3 → Actes 2 — effusion eschatologique.`,
      `Romains 8 — Esprit de vie et d’adoption.`
    ],
    praxis: [
      `Demander la conduite de l’Esprit dans la lecture et la prière.`,
      `Exercer les dons avec charité et ordre; viser l’édification.`,
      `Relier piété personnelle et mission: souffle reçu, souffle donné.`
    ]
  });
}

function buildAlliance(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Alliance**',
    thesis:
      `L’Alliance est le cadre structurant de la révélation: Dieu se donne par promesse et commandement, ` +
      `et façonne un peuple pour son Nom. Les alliances s’embrassent et culminent en la **Nouvelle Alliance** en Christ.`,
    axes: [
      `**Unité dans la diversité**: Noé, Abraham, Sinaï, David, Nouvelle Alliance.`,
      `**Signes**: circoncision/baptême; Pâque/Cène — mémoire et identité.`,
      `**Fidélité de Dieu**, responsabilité du peuple, discipline paternelle.`,
      `**Christ médiateur** et scellé par l’Esprit.`
    ],
    canons: [
      `Genèse 12; 15; 17 — Abraham.`,
      `Exode 19–24 — Sinaï.`,
      `Jérémie 31:31–34 — Nouvelle Alliance.`,
      `Luc 22:20; Hébreux 8–10.`
    ],
    praxis: [
      `Vivre la foi comme relation d’Alliance: écoute, signes, obéissance.`,
      `Inscrire la mémoire des œuvres de Dieu dans la vie communautaire.`,
      `Recevoir la discipline comme grâce formatrice.`
    ]
  });
}

function buildEglise(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Église**',
    thesis:
      `L’Église n’est pas d’abord une association humaine, mais le **peuple convoqué** par la Parole, ` +
      `rassemblé par l’Esprit autour du Christ. Une, sainte, catholique, apostolique: ses notes orientent sa mission.`,
    axes: [
      `**Parole & sacrements** comme moyens désignés de grâce.`,
      `**Gouvernance servante**: anciens/diacres; discipline et soin.`,
      `**Unité dans la diversité** des dons; catholicité de la foi.`,
      `**Témoignage**: sainteté hospitalière, justice et miséricorde.`
    ],
    canons: [
      `Actes 2:42–47 — vie primitive.`,
      `Éphésiens 4 — édification du corps.`,
      `1 Pierre 2 — sacerdoce royal.`
    ],
    praxis: [
      `Ancrer la communauté dans la Parole et la prière.`,
      `Exercer une charité ordonnée: accueil, vérité, justice.`,
      `Servir la cité sans se confondre avec elle.`
    ]
  });
}

function buildDisciples(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Discipulat**',
    thesis:
      `Être disciple, c’est **apprendre du Christ** pour lui ressembler: écoute, imitation, persévérance. ` +
      `La grâce ne remplace pas l’apprentissage, elle le rend possible.`,
    axes: [
      `**Appel et réponse** (Marc 1).`,
      `**Formation par la Parole**, les épreuves et la communauté.`,
      `**Obéissance concrète**: renoncements, choix, service.`,
      `**Persévérance**: croix quotidienne, joie solide.`
    ],
    canons: [
      `Matthieu 5–7 — enseignement du Roi.`,
      `Jean 13–17 — école de la charité.`,
      `Hébreux 12 — discipline qui sanctifie.`
    ],
    praxis: [
      `Rythmer sa vie: Écriture, prière, accompagnement.`,
      `Identifier des pas obéissants précis et mesurables.`,
      `Relier apprentissage et mission: recevoir pour donner.`
    ]
  });
}

function buildEthique(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Éthique**',
    thesis:
      `L’éthique chrétienne découle de l’Évangile: elle n’achète pas le salut; elle **en exprime la forme**. ` +
      `Elle conjugue vérité et miséricorde, justice et paix, dans la vie ordinaire.`,
    axes: [
      `**Fondement**: Dieu saint, image de Dieu, loi accomplie en l’amour.`,
      `**Vertus**: foi, espérance, charité; humilité, tempérance, courage.`,
      `**Discernement**: casuistique charitative; conscience éclairée.`,
      `**Communauté**: correction fraternelle, bien commun.`
    ],
    canons: [
      `Exode 20; Deutéronome 6 — Loi.`,
      `Romains 12–15 — culte raisonnable et vie sociale.`,
      `Jacques — sagesse pratique.`
    ],
    praxis: [
      `Examiner ses pratiques à la lumière de la Parole.`,
      `Cultiver des habitudes vertueuses concrètes.`,
      `Chercher la justice sans perdre la miséricorde.`
    ]
  });
}

function buildPriere(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Prière**',
    thesis:
      `La prière est la **respiration** de la foi: réponse confiante à la Parole, structurée par le Notre Père, ` +
      `inscrite dans l’Alliance, nourrie par l’Esprit qui intercède en nous.`,
    axes: [
      `**Adoration et action de grâce**: reconnaître Dieu comme Dieu.`,
      `**Confession et intercession**: vérité et charité.`,
      `**Demande filiale**: confiance persévérante (Luc 11).`,
      `**Rythme communautaire**: prière de l’Église pour le monde.`
    ],
    canons: [
      `Psaumes — école de prière.`,
      `Matthieu 6 — Notre Père.`,
      `Romains 8:26–27 — intercession de l’Esprit.`
    ],
    praxis: [
      `Installer un rythme simple et durable (matin/soir, psaume/évangile).`,
      `Prendre des sujets précis; noter exaucements et leçons.`,
      `Prier la Parole lue: Écriture → prière → obéissance.`
    ]
  });
}

function buildMission(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Mission**',
    thesis:
      `La mission procède du cœur de Dieu: le Père envoie le Fils, le Père et le Fils envoient l’Esprit, ` +
      `et l’Esprit envoie l’Église. Témoigner, servir, faire des disciples jusqu’aux extrémités de la terre.`,
    axes: [
      `**Évangélisation**: proclamation humble et fidèle.`,
      `**Justice et miséricorde**: signe du Royaume.`,
      `**Implantation et formation**: Églises qui enfantent.`,
      `**Souffrance et joie**: prix réel, consolation réelle.`
    ],
    canons: [
      `Matthieu 28:18–20 — mandat missionnaire.`,
      `Actes — expansion sous la conduite de l’Esprit.`,
      `1 Thessaloniciens — modèle missionnel.`
    ],
    praxis: [
      `Témoigner dans son réseau ordinaire.`,
      `Relier parole et service concret.`,
      `Soutenir la mission par la prière et les dons.`
    ]
  });
}

function buildEsperance(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Espérance**',
    thesis:
      `L’espérance chrétienne n’est pas un optimisme vague: elle repose sur la **résurrection du Christ** ` +
      `et l’attente de la nouvelle création. Elle transforme la persévérance présente.`,
    axes: [
      `**Résurrection**: gage et prémices (1 Corinthiens 15).`,
      `**Jugement**: justice pour les victimes, sérieux du mal.`,
      `**Nouvelle création**: ciel nouveau et terre nouvelle (Apoc 21–22).`,
      `**Vigilance**: vivre comme des enfants du jour.`
    ],
    canons: [
      `Romains 8 — gémissement et espérance.`,
      `1 Pierre 1:3–9 — joie éprouvée.`,
      `Apocalypse — liturgie de l’espérance.`
    ],
    praxis: [
      `Interpréter les épreuves à la lumière de la fin.`,
      `Cultiver les signes de vie nouvelle dès maintenant.`,
      `Consoler avec compétence et fidélité.`
    ]
  });
}

function buildExhortation(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Exhortation**',
    thesis:
      `L’exhortation biblique n’est pas de la dureté morale: c’est l’appel **paternel** qui, sur la base de l’Évangile, ` +
      `oriente la marche concrète du peuple.`,
    axes: [
      `**Rappeler l’Évangile** avant l’appel.`,
      `**Nommer** clairement le bien et le mal.`,
      `**Encourager** la persévérance et la joie.`,
      `**Accompagner**: correction fraternelle et douceur.`
    ],
    canons: [
      `Hébreux — “encouragez-vous” (3:13; 10:24–25).`,
      `Éphésiens 4–6 — indicatif/impératif.`,
    ],
    praxis: [
      `Pratiquer une exhortation qui élève sans écraser.`,
      `Relier appel public et soins personnels.`,
      `Mesurer des progrès concrets et rendre grâce.`
    ]
  });
}

function buildApplicationPerso(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Application personnelle**',
    thesis:
      `La vraie application naît de la **doctrine reçue**: l’intelligence éclaire la conscience, qui oriente la volonté. ` +
      `Elle est spécifique, mesurable, réaliste et enracinée dans la grâce.`,
    axes: [
      `**Examiner**: où ce texte contredit mes habitudes ?`,
      `**Décider**: un pas clair à poser cette semaine.`,
      `**Rendre compte**: redevabilité fraternelle.`,
      `**Célébrer**: la grâce à l’œuvre, même petite.`
    ],
    canons: [
      `Jacques 1:22–25 — mettre en pratique.`,
      `Psaume 139:23–24 — examen guidé.`
    ],
    praxis: [
      `Écrire une résolution concrète liée au chapitre.`,
      `Prévoir un moment de revue et d’action de grâce.`,
      `Associer prière et action: pas de volontarisme sec.`
    ]
  });
}

function buildApplicationCollective(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Application communautaire**',
    thesis:
      `Dieu façonne un **peuple**: l’application ecclésiale concerne la doctrine, la liturgie, la diaconie, ` +
      `la mission et la vie fraternelle.`,
    axes: [
      `**Unité doctrinale essentielle**, charité dans les secondaires.`,
      `**Liturgie formative**: Parole, prière, sacrements.`,
      `**Diaconie**: justice et miséricorde en actes.`,
      `**Mission locale**: présence fidèle et humble.`
    ],
    canons: [
      `Actes 2:42–47 — quatre piliers.`,
      `Éphésiens 4 — édification mutuelle.`
    ],
    praxis: [
      `Auditer les pratiques à la lumière du chapitre.`,
      `Former, prier, servir: un calendrier concret.`,
      `Mesurer: fruits de paix, de justice, de joie.`
    ]
  });
}

function buildLiturgie(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Liturgie**',
    thesis:
      `Le culte façonne l’amour. La liturgie n’est pas décoration, mais **pédagogie** de l’Évangile: ` +
      `Dieu parle, le peuple répond. Parole et sacrements ordonnent la semaine entière.`,
    axes: [
      `**Appel/Confession/Annonce**: évangile rythmé.`,
      `**Lecture et prédication**: Dieu s’adresse aujourd’hui.`,
      `**Sacraments**: signes visibles de la grâce invisible.`,
      `**Envoi**: liturgie du monde, service du prochain.`
    ],
    canons: [
      `Ésaïe 6 — liturgie du Trône.`,
      `Luc 24 — Écritures et fraction du pain.`,
      `Actes 2 — pratique primitive.`
    ],
    praxis: [
      `Préparer le cœur avant le culte; prolonger après.`,
      `Chanter vrai: vérité + affection réglée.`,
      `Relier liturgie dominicale et semaine missionnelle.`
    ]
  });
}

function buildMeditation(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Méditation**',
    thesis:
      `Méditer, c’est **ruminer** la Parole jusqu’à ce qu’elle façonne les affections et les choix. ` +
      `La méditation chrétienne est verbale, doctrinale, priante, et orientée vers l’obéissance.`,
    axes: [
      `**Lenteur**: laisser la Parole descendre.`,
      `**Mémoire**: répéter, noter, prier.`,
      `**Affection**: aimer ce que Dieu dit être bon.`,
      `**Action**: transformer la contemplation en pas concrets.`
    ],
    canons: [
      `Psaume 1 — arbre planté.`,
      `Josué 1:8 — prospérité de l’obéissance.`
    ],
    praxis: [
      `Choisir un verset-clé du chapitre; le prier matin/soir.`,
      `Noter une lumière et une action par jour.`,
      `Partager en fraternité un fruit de méditation.`
    ]
  });
}

function buildMemoVerset(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Verset-clé**',
    thesis:
      `La mémorisation d’un verset n’est pas un exercice scolaire, mais une **inscription de la Parole** dans le cœur ` +
      `pour la prière, le combat spirituel et le témoignage.`,
    axes: [
      `**Choix**: verset qui condense le fil doctrinal du chapitre.`,
      `**Mémorisation**: répétition espacée, écriture, prière.`,
      `**Intégration**: réutiliser le verset en décision concrète.`,
      `**Transmission**: l’enseigner à un proche.`
    ],
    canons: [
      `Psaume 119:11 — garder ta parole dans mon cœur.`,
      `Colossiens 3:16 — que la Parole habite richement.`
    ],
    praxis: [
      `Écrire le verset; l’afficher; le prier.`,
      `Le citer en situation de tentation ou d’angoisse.`,
      `Rendre grâce pour chaque rappel à propos.`
    ],
    scelle: `**Prière** — Seigneur, grave ce verset dans ma mémoire et mes affections; qu’il guide mes pas, aujourd’hui même. Amen.`
  });
}

function buildTypologie(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Typologie**',
    thesis:
      `La typologie reconnaît les **figures** par lesquelles Dieu prépare l’intelligence du Christ et de son œuvre, ` +
      `sans violence du sens: continuité historique, analogie voulue, accomplissement supérieur.`,
    axes: [
      `**Repérer** les motifs récurrents (roi, prophète, temple, exode).`,
      `**Vérifier** l’ancrage contextuel et canonique.`,
      `**Orienter** vers le Christ, non vers des spéculations.`,
      `**Discerner** entre typologie et allégorie libre.`
    ],
    canons: [
      `Matthieu — accomplissements typologiques.`,
      `Hébreux — temple/sacrifices accomplis.`,
    ],
    praxis: [
      `Lire les figures pour mieux adorer le Christ.`,
      `Garder sobriété et précision exégétique.`,
      `Éviter sur-lectures et symbolismes arbitraires.`
    ]
  });
}

function buildTheologieSystematique(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Théologie systématique**',
    thesis:
      `La systématique ordonne les **loci** (Dieu, Christ, Esprit, Écriture, Église, Salut, Fin dernières) ` +
      `pour articuler une confession cohérente, fidèle au canon entier.`,
    axes: [
      `**Sola Scriptura**: norme normative; tradition ministre.`,
      `**Analogie de la foi**: textes éclairés par l’ensemble.`,
      `**Hiérarchie des vérités**: centre christologique.`,
      `**Finalité pastorale**: vérité pour la vie.`
    ],
    canons: [
      `2 Timothée 3:14–17 — utilité de l’Écriture.`,
      `Hébreux 4:12 — Parole vivante et efficace.`
    ],
    praxis: [
      `Relier lecture suivie et synthèse doctrinale.`,
      `Repérer doctrines centrales vs. périphériques.`,
      `Confesser avec l’Église une foi commune.`
    ]
  });
}

function buildHistoireDuSalut(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Histoire du salut**',
    thesis:
      `Une seule **économie**: création, chute, promesse, élection, loi, prophètes, Christ, Église, Parousie. ` +
      `Chaque page s’y insère, révélant une fidélité patiente qui conduit à la plénitude.`,
    axes: [
      `**Promesse/Accomplissement**: continuité non plate.`,
      `**Crise/Relèvement**: pédagogie divine.`,
      `**Déjà/Pas encore**: tension eschatologique.`,
      `**Peuple/Toutes nations**: élargissement missionnel.`
    ],
    canons: [
      `Genèse → Apocalypse — arc narratif.`,
      `Luc 24 — clé christocentrique.`,
    ],
    praxis: [
      `Lire chaque chapitre comme station sur l’axe du salut.`,
      `Tenir la mémoire de Dieu pour nourrir la fidélité.`,
      `Témoigner d’une espérance située dans l’histoire.`
    ]
  });
}

function buildThemesSecondaires(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Thèmes secondaires**',
    thesis:
      `Autour du fil directeur gravitent des **thèmes satellites** (vocabulaire, motifs, personnages, lieux) ` +
      `qui nuancent la doctrine et affinent l’application.`,
    axes: [
      `**Lexique**: mots clés et champs sémantiques.`,
      `**Rythmes littéraires**: répétitions, contrastes, inclusions.`,
      `**Géographie et temps**: théologie du lieu et du kairos.`,
      `**Voix secondaires**: témoins et contre-exemples.`
    ],
    canons: [
      `Proverbes — nuances sapientielles.`,
      `Actes — géographie missionnelle.`,
    ],
    praxis: [
      `Noter deux motifs secondaires et leur portée.`,
      `Éviter de les absolutiser; garder le centre.`,
      `Transformer nuances en décisions concrètes.`
    ]
  });
}

function buildDoutesObjections(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Doutes/objections**',
    thesis:
      `Les doutes appellent une **réponse patiente**: précision exégétique, clarté doctrinale, accompagnement pastoral. ` +
      `On ne guérit pas un scrupule par un slogan, mais par la vérité en charité.`,
    axes: [
      `**Écouter** la question réelle derrière les mots.`,
      `**Clarifier** le texte: contexte, genre, canon.`,
      `**Répondre** en reliant toujours à l’Évangile.`,
      `**Accompagner**: temps, prière, communauté.`
    ],
    canons: [
      `1 Pierre 3:15 — douceur et respect.`,
      `Jude 22–23 — sauver en arrachant du feu.`
    ],
    praxis: [
      `Tenir un espace de questions franc.`,
      `Fournir des ressources fiables et progressives.`,
      `Prier avec la personne; viser la maturité.`
    ]
  });
}

function buildSynthese(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Synthèse**',
    thesis:
      `La synthèse recueille le **fil doctrinal** du chapitre, ordonne les résonances, ` +
      `et désigne le pas d’obéissance pour aujourd’hui.`,
    axes: [
      `**Vérité sur Dieu**: sainteté, grâce, fidélité.`,
      `**Diagnostic sur l’homme**: besoin réel de salut.`,
      `**Chemin en Christ**: pardon et nouveauté de vie.`,
      `**Fruit**: prière, obéissance, témoignage.`
    ],
    canons: [
      `Psaume 119 — Parole qui éclaire la route.`,
      `Romains 12 — culte raisonnable.`
    ],
    praxis: [
      `Formuler une phrase-synthèse en 1–2 lignes.`,
      `Choisir un pas concret à poser cette semaine.`,
      `Partager la grâce reçue avec un proche.`
    ]
  });
}

function buildPlanDeLecture(ctx) {
  return buildLongDoctrineSection(ctx, {
    title: '**Plan de lecture**',
    thesis:
      `La Parole forme par **durée**: une discipline simple, joyeuse, communautaire. ` +
      `Lire pour prier, prier pour obéir, obéir pour témoigner.`,
    axes: [
      `**Rythme**: portions réalistes; alternance AT/NT; Psaumes quotidiens.`,
      `**Profondeur**: observation, interprétation, application.`,
      `**Communauté**: partage, redevabilité, intercession.`,
      `**Souplesse**: adapter sans culpabiliser; viser la fidélité.`
    ],
    canons: [
      `Josué 1:8 — jour et nuit.`,
      `Actes 17:11 — Bereens: examen quotidien.`
    ],
    praxis: [
      `Établir un plan de 4–6 semaines lié au livre étudié.`,
      `Prévoir un journal simple (lumière / action / prière).`,
      `Intégrer un rendez-vous fraternel bi-hebdomadaire.`
    ]
  });
}
