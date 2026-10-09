import "bootstrap/dist/css/bootstrap.min.css";
import "./legal.css";

type Language = "es" | "en" | "fr";
type DocumentId = "privacy" | "terms" | "contact";

interface Section {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalDocument {
  title: string;
  introduction: string;
  sections: Section[];
}

interface TeamMember {
  name: string;
  email?: string;
  instagramUrl?: string;
  instagramHandle?: string;
}

interface LegalCopy {
  project: string;
  lastUpdated: string;
  languageLabel: string;
  languages: Record<Language, string>;
  documents: Record<DocumentId, string>;
  projectDisclaimer: string;
  backToProject: string;
  roleLabel: string;
  emailLabel: string;
  instagramLabel: string;
  pendingLabel: string;
  contactLinksLabel: string;
  footer: string;
  pages: Record<DocumentId, LegalDocument>;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Andrés Sánchez Pérez",
    email: "anndreesh@icloud.com",
    instagramUrl: "https://www.instagram.com/anndreesh_/",
    instagramHandle: "@anndreesh_",
  },
  {
    name: "José Andrés Pérez del Cid",
    instagramUrl: "https://www.instagram.com/andres__del_cid/",
    instagramHandle: "@andres__del_cid",
  },
  {
    name: "Diego José Estrada Pereira",
    instagramUrl: "https://www.instagram.com/tg_diegoj/",
    instagramHandle: "@tg_diegoj",
  },
  { name: "Luis Enrique Contreras Hernández" },
  { name: "José Carlos Arana Mejía" },
];
const LANGUAGE_KEY = "mm.language";
const LANGUAGES: Language[] = ["es", "en", "fr"];
const DOCUMENTS: DocumentId[] = ["privacy", "terms", "contact"];

const copy: Record<Language, LegalCopy> = {
  es: {
    project: "GuaTec",
    lastUpdated: "Última actualización: 8 de octubre de 2026",
    languageLabel: "Idioma",
    languages: { es: "Español", en: "English", fr: "Français" },
    documents: {
      privacy: "Privacidad",
      terms: "Términos de uso",
      contact: "Contacto",
    },
    projectDisclaimer:
      "GuaTec es un proyecto independiente, educativo y de simulación. No es un producto oficial de la NASA ni está afiliado, patrocinado o avalado por la NASA.",
    backToProject: "Volver a GuaTec",
    roleLabel: "Rol",
    emailLabel: "Correo electrónico",
    instagramLabel: "Instagram",
    pendingLabel: "Pendiente",
    contactLinksLabel: "Canales de contacto",
    footer:
      "La documentación describe las funciones disponibles en GuaTec a la fecha de actualización.",
    pages: {
      privacy: {
        title: "Política de privacidad",
        introduction:
          "Esta política explica qué datos se procesan cuando creas una cuenta, accedes a GuaTec o guardas tu avance; para qué se usan y cómo puedes ejercer tus derechos.",
        sections: [
          {
            title: "1. Datos que se procesan",
            paragraphs: [
              "Según la forma de acceso elegida, se procesa la dirección de correo electrónico y una contraseña almacenada únicamente como hash; o los datos de cuenta, identificador y, si está disponible, nombre e imagen de perfil recibidos de Google o GitHub. El acceso de invitado crea un perfil seudónimo. También puedes elegir un nombre de usuario.",
              "Para que GuaTec funcione y guarde tu avance, se procesan tu identificador de cuenta, el estado guardado de las misiones, decisiones, recursos, muestras, resultados e indicadores de uso de la simulación, así como fechas de inicio o finalización cuando se generan.",
              "El navegador guarda localmente el idioma, el nombre de usuario en caché, un token de acceso de duración limitada y, durante el alta mediante OAuth, temporalmente el correo pendiente. La plataforma de alojamiento puede generar registros técnicos de solicitudes, como dirección IP, fecha, navegador y errores.",
            ],
          },
          {
            title: "2. Finalidades y fundamento",
            paragraphs: [
              "Los datos se utilizan para crear y proteger cuentas, iniciar sesión, verificar la identidad, guardar y recuperar el progreso, mostrar informes y estadísticas, prevenir abusos y mantener el servicio. Las bases jurídicas se aplican según el país: prestación de la función que solicitas, consentimiento cuando corresponda e intereses legítimos de seguridad y mantenimiento, sin prevalecer sobre tus derechos.",
              "No se venden datos personales ni el código de GuaTec implementa publicidad personalizada. No introduzcas en nombres de usuario, correo u otros campos datos sensibles o información de otras personas.",
            ],
          },
          {
            title: "3. Proveedores y transferencias",
            paragraphs: [
              "GuaTec usa Vercel para servir el sitio y ejecutar la API, y Supabase/PostgreSQL para almacenar los datos si se habilita la conexión de producción. Google o GitHub reciben solicitudes cuando eliges uno de esos métodos de acceso y tratan esos datos bajo sus propias políticas. La API puede consultar servicios públicos de NASA para material e información espacial; esas solicitudes no necesitan enviar a NASA tu contraseña ni tu progreso. Si el navegador carga recursos alojados por terceros, dichos proveedores pueden recibir los datos técnicos habituales de la conexión.",
              "Estos proveedores pueden tratar información en los países donde operan sus centros de datos. Consulta sus políticas y configuraciones para conocer sus ubicaciones, condiciones de transferencia y plazos de conservación.",
            ],
          },
          {
            title: "4. Almacenamiento y conservación",
            paragraphs: [
              "El token y otras preferencias de GuaTec se guardan en el almacenamiento local del navegador, no en una cookie de seguimiento. El token permite utilizar la sesión y caduca conforme a la configuración del servidor. Puedes cerrar sesión para borrar el token y eliminar los datos locales del navegador; eso no borra el avance que ya está guardado en el servidor.",
              "Los registros y avances vinculados a tu cuenta se conservan mientras la cuenta siga activa o sean necesarios para prestar el servicio. Para pedir su eliminación, escribe al correo de contacto desde la dirección asociada a la cuenta e indica tu nombre de usuario. Se verificará la solicitud y se eliminarán los datos que puedan borrarse, salvo los que deban conservarse por seguridad, obligaciones legales o copias de respaldo durante su ciclo normal.",
            ],
          },
          {
            title: "5. Tus derechos y consultas",
            paragraphs: [
              "Según la legislación aplicable, puedes solicitar acceso, corrección, eliminación, portabilidad o limitación del tratamiento, oponerte al tratamiento y retirar un consentimiento. También puedes presentar una reclamación ante la autoridad de protección de datos competente. Para ejercer estos derechos o reportar una preocupación de privacidad, ponte en contacto mediante los canales siguientes.",
            ],
          },
          {
            title: "6. Menores y cambios",
            paragraphs: [
              "GuaTec es educativo; no solicita deliberadamente información sensible ni está diseñado para que se publiquen datos personales. Si eres menor, utiliza GuaTec con el acompañamiento de una persona adulta cuando así lo exija tu legislación. Si una persona responsable cree que se proporcionaron datos de un menor de forma inadecuada, puede pedir su revisión o eliminación.",
              "Esta política puede actualizarse cuando cambien el código, los proveedores o las obligaciones legales. La fecha de actualización que figura arriba identifica la versión publicada.",
            ],
          },
        ],
      },
      terms: {
        title: "Términos y condiciones de uso",
        introduction:
          "Al acceder a GuaTec aceptas estas condiciones. Si no estás de acuerdo, no crees una cuenta ni continúes usando el servicio.",
        sections: [
          {
            title: "1. GuaTec",
            paragraphs: [
              "GuaTec es una experiencia educativa y de simulación de exploración espacial. Sus escenas, decisiones, cronología, resultados y sistemas son representaciones narrativas o mecánicas; no constituyen datos científicos, predicciones ni instrucciones profesionales. Las referencias históricas y los recursos de terceros conservan sus respectivas autorías y condiciones de uso.",
              "GuaTec es independiente y no está afiliado, patrocinado ni avalado por la NASA. Los nombres y referencias de NASA identifican fuentes o temas relacionados, no una asociación institucional.",
            ],
          },
          {
            title: "2. Cuentas y uso aceptable",
            paragraphs: [
              "Debes proporcionar datos de acceso correctos, mantener tu contraseña en privado y avisar si sospechas un acceso no autorizado. Eres responsable de la actividad realizada en tu cuenta mientras tengas control de ella.",
            ],
            bullets: [
              "Utiliza GuaTec de forma legal y no intentes acceder a cuentas, datos o sistemas sin autorización.",
              "No interfieras con el servicio, no introduzcas código dañino ni eludas controles de seguridad.",
              "No uses nombres de usuario o perfiles para suplantar, acosar o divulgar datos personales propios o ajenos.",
              "No presentes decisiones o simulaciones como instrucciones reales para construir, lanzar u operar equipos.",
            ],
          },
          {
            title: "3. Propiedad intelectual y servicios externos",
            paragraphs: [
              "El código, la identidad visual y los materiales originales de GuaTec corresponden a sus titulares y se ofrecen conforme a las licencias aplicables. Los recursos de NASA, Poly Haven, proveedores de acceso y otros terceros siguen sujetos a sus propios derechos y términos; su mención no transfiere propiedad ni implica respaldo.",
              "El acceso mediante Google o GitHub y el alojamiento/base de datos dependen de servicios externos. Su disponibilidad y tratamiento también se rigen por las condiciones y políticas de esos proveedores.",
            ],
          },
          {
            title: "4. Disponibilidad, cambios y responsabilidad",
            paragraphs: [
              "GuaTec se proporciona en su estado actual y puede modificarse, interrumpirse o dejar de estar disponible, con o sin aviso, según lo permita la ley. Aunque se intenta proteger el progreso guardado, no se garantiza que los datos estén siempre disponibles ni que no ocurran interrupciones o pérdidas.",
              "En la máxima medida permitida por la ley, quienes mantienen GuaTec no responden por daños indirectos derivados del uso o la indisponibilidad de la simulación, ni por decisiones basadas en su contenido. Nada de estos términos excluye derechos o responsabilidades que legalmente no puedan excluirse.",
            ],
          },
          {
            title: "5. Suspensión, privacidad y cambios en los términos",
            paragraphs: [
              "El acceso puede suspenderse si se incumplen estas condiciones, existe riesgo para el servicio o así lo exige la ley. El tratamiento de datos se describe en la Política de privacidad disponible en esta página.",
              "Las condiciones pueden cambiar para reflejar mejoras, funciones nuevas u obligaciones legales. Si el cambio es sustancial, se indicará una fecha de revisión actualizada. El uso posterior a la publicación de los nuevos términos implica su aceptación en la medida permitida por la legislación aplicable.",
            ],
          },
          {
            title: "6. Legislación y contacto",
            paragraphs: [
              "Se aplicarán los derechos imperativos y las normas de protección al consumidor de tu lugar de residencia cuando correspondan. Las cuestiones relacionadas con estas condiciones pueden comunicarse por los canales indicados a continuación.",
            ],
          },
        ],
      },
      contact: {
        title: "Contacto",
        introduction:
          "¿Tienes una pregunta sobre GuaTec, una cuenta, tus datos personales o estas condiciones? Consulta los canales de contacto del equipo.",
        sections: [
          {
            title: "Privacidad y cuentas",
            paragraphs: [
              "Para solicitar acceso, corrección o eliminación de datos, incluye el correo asociado a la cuenta y, si corresponde, el nombre de usuario. No envíes contraseñas ni tokens de sesión. Puede ser necesario verificar la titularidad antes de atender la solicitud.",
            ],
          },
          {
            title: "Comentarios sobre GuaTec",
            paragraphs: [
              "También puedes escribirnos si detectas un problema de accesibilidad, una atribución incorrecta o un error en el contenido educativo. Describe la pantalla o el tema afectado sin compartir información sensible.",
            ],
          },
        ],
      },
    },
  },
  en: {
    project: "GuaTec",
    lastUpdated: "Last updated: October 8, 2026",
    languageLabel: "Language",
    languages: { es: "Español", en: "English", fr: "Français" },
    documents: {
      privacy: "Privacy policy",
      terms: "Terms of use",
      contact: "Contact",
    },
    projectDisclaimer:
      "GuaTec is an independent educational simulation. It is not an official NASA product and is not affiliated with, sponsored by, or endorsed by NASA.",
    backToProject: "Back to GuaTec",
    roleLabel: "Role",
    emailLabel: "Email",
    instagramLabel: "Instagram",
    pendingLabel: "Pending",
    contactLinksLabel: "Contact channels",
    footer:
      "This documentation describes the features available in GuaTec as of the update date.",
    pages: {
      privacy: {
        title: "Privacy policy",
        introduction:
          "This policy explains what data is processed when you create an account, sign in to GuaTec, or save your progress; why it is used and how you can exercise your rights.",
        sections: [
          {
            title: "1. Data we process",
            paragraphs: [
              "Depending on how you sign in, we process your email address and a password stored only as a hash; or account details, provider identifier and, when available, profile name and image received from Google or GitHub. Guest access creates a pseudonymous profile. You may also choose a username.",
              "To operate GuaTec and save your progress, we process your account identifier, saved mission progress and state, decisions, resources, samples, results and simulation usage metrics, together with start or completion dates when generated.",
              "Your browser stores the language, a cached username, a time-limited access token and, during OAuth sign-up, the pending email address temporarily. The hosting platform may generate technical request logs such as IP address, date, browser information and errors.",
            ],
          },
          {
            title: "2. Purposes and legal grounds",
            paragraphs: [
              "Data is used to create and secure accounts, sign in, verify identity, save and restore progress, display reports and statistics, prevent abuse, and maintain the service. Legal grounds depend on your country and may include providing the feature you request, consent where applicable, and legitimate interests in security and maintenance, balanced against your rights.",
              "Personal data is not sold, and GuaTec's code does not implement personalized advertising. Do not enter sensitive information or another person's information in usernames, email fields or other fields.",
            ],
          },
          {
            title: "3. Providers and transfers",
            paragraphs: [
              "GuaTec uses Vercel to serve the site and run the API, and Supabase/PostgreSQL to store data if the production database is enabled. Google or GitHub receive requests when you choose one of those sign-in methods and process data under their own policies. The API may request public NASA services for space-related material and information; those requests do not require sending NASA your password or progress. If your browser loads third-party-hosted resources, those providers may receive ordinary technical connection data.",
              "These providers may process information in the countries where their data centers operate. Consult their policies and configuration to learn their locations, transfer terms and retention periods.",
            ],
          },
          {
            title: "4. Storage and retention",
            paragraphs: [
              "The access token and other GuaTec preferences are saved in your browser's local storage, not in a tracking cookie. The token enables your session and expires according to the server configuration. You can sign out to remove the token and clear local browser data; this does not delete progress already saved on the server.",
              "Records and progress linked to your account are retained while your account is active or as needed to provide the service. To request deletion, email the contact address from the email linked to your account and provide your username. We will verify the request and delete data that can be erased, except data that must be kept for security, legal obligations or backups during their normal lifecycle.",
            ],
          },
          {
            title: "5. Your rights and questions",
            paragraphs: [
              "Depending on applicable law, you may request access, correction, deletion, portability or restriction of processing; object to processing; or withdraw consent. You may also lodge a complaint with the competent data protection authority. Use the contact channels below to exercise these rights or report a privacy concern.",
            ],
          },
          {
            title: "6. Children and changes",
            paragraphs: [
              "GuaTec is educational; it does not deliberately request sensitive information or provide a space for publishing personal details. If you are a minor, use GuaTec with adult supervision when required by your local law. A parent or guardian who believes a minor's information was provided inappropriately may request its review or deletion.",
              "This policy may change when the code, providers or legal requirements change. The update date above identifies the published version.",
            ],
          },
        ],
      },
      terms: {
        title: "Terms and conditions of use",
        introduction:
          "By accessing GuaTec, you agree to these terms. If you do not agree, do not create an account or continue using the service.",
        sections: [
          {
            title: "1. GuaTec",
            paragraphs: [
              "GuaTec is an educational space-exploration simulation. Its scenes, decisions, timeline, results and systems are narrative representations or simulation systems; they are not scientific data, predictions or professional instructions. Historical references and third-party resources remain subject to their respective attribution and terms.",
              "GuaTec is independent and is not affiliated with, sponsored by, or endorsed by NASA. NASA names and references identify sources or related subject matter, not an institutional partnership.",
            ],
          },
          {
            title: "2. Accounts and acceptable use",
            paragraphs: [
              "Provide accurate sign-in information, keep your password private and report suspected unauthorized access. You are responsible for activity on your account while it is under your control.",
            ],
            bullets: [
              "Use GuaTec lawfully and do not attempt to access accounts, data or systems without authorization.",
              "Do not interfere with the service, introduce malicious code or bypass security controls.",
              "Do not use usernames or profiles to impersonate, harass or disclose personal information about yourself or others.",
              "Do not present simulations or decisions as real-world instructions for building, launching or operating equipment.",
            ],
          },
          {
            title: "3. Intellectual property and third-party services",
            paragraphs: [
              "GuaTec's code, visual identity and original materials belong to their respective rights holders and are provided subject to applicable licenses. NASA, Poly Haven, sign-in provider and other third-party resources remain subject to their own rights and terms; mentioning them does not transfer ownership or imply endorsement.",
              "Sign-in through Google or GitHub, and hosting/database functionality, depend on external services. Their availability and data processing are also governed by those providers' terms and policies.",
            ],
          },
          {
            title: "4. Availability, changes and liability",
            paragraphs: [
              "GuaTec is provided as it currently exists and may be modified, interrupted or discontinued, with or without notice, as permitted by law. While we try to protect saved progress, we do not guarantee that data will always be available or that interruptions or loss will not occur.",
              "To the maximum extent permitted by law, the people maintaining GuaTec are not liable for indirect damages arising from use or unavailability of the simulation or decisions based on its content. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.",
            ],
          },
          {
            title: "5. Suspension, privacy and changes to these terms",
            paragraphs: [
              "Access may be suspended if these terms are violated, the service is at risk, or the law requires it. Data processing is described in the Privacy Policy available on this page.",
              "These terms may change to reflect improvements, new features or legal requirements. Substantial changes will be indicated by an updated review date. Continued use after publication of new terms constitutes acceptance to the extent permitted by applicable law.",
            ],
          },
          {
            title: "6. Law and contact",
            paragraphs: [
              "Mandatory legal protections and consumer rights in your place of residence apply where relevant. Questions about these terms can be sent using the contact channels below.",
            ],
          },
        ],
      },
      contact: {
        title: "Contact",
        introduction:
          "Have a question about GuaTec, an account, your personal data or these terms? See the GuaTec team's contact channels.",
        sections: [
          {
            title: "Privacy and accounts",
            paragraphs: [
              "To request access to, correction or deletion of data, include the email address associated with your account and, where applicable, your username. Do not send passwords or session tokens. We may need to verify account ownership before processing a request.",
            ],
          },
          {
            title: "GuaTec feedback",
            paragraphs: [
              "You can also report an accessibility issue, incorrect attribution or an error in educational content. Describe the affected screen or topic without sharing sensitive information.",
            ],
          },
        ],
      },
    },
  },
  fr: {
    project: "GuaTec",
    lastUpdated: "Dernière mise à jour : 8 octobre 2026",
    languageLabel: "Langue",
    languages: { es: "Español", en: "English", fr: "Français" },
    documents: {
      privacy: "Confidentialité",
      terms: "Conditions d’utilisation",
      contact: "Contact",
    },
    projectDisclaimer:
      "GuaTec est une simulation éducative indépendante. Ce n'est pas un produit officiel de la NASA et GuaTec n'est ni affilié, ni financé, ni approuvé par la NASA.",
    backToProject: "Retour à GuaTec",
    roleLabel: "Rôle",
    emailLabel: "E-mail",
    instagramLabel: "Instagram",
    pendingLabel: "À renseigner",
    contactLinksLabel: "Moyens de contact",
    footer:
      "Cette documentation décrit les fonctionnalités de GuaTec à la date de mise à jour.",
    pages: {
      privacy: {
        title: "Politique de confidentialité",
        introduction:
          "Cette politique explique quelles données sont traitées lorsque vous créez un compte, vous connectez à GuaTec ou sauvegardez votre progression, pourquoi elles sont utilisées et comment exercer vos droits.",
        sections: [
          {
            title: "1. Données traitées",
            paragraphs: [
              "Selon votre mode de connexion, nous traitons votre adresse e-mail et un mot de passe stocké uniquement sous forme de hachage ; ou les données de compte, l'identifiant fournisseur et, lorsqu'ils sont disponibles, le nom et l'image de profil transmis par Google ou GitHub. L'accès invité crée un profil pseudonyme. Vous pouvez également choisir un nom d'utilisateur.",
              "Pour faire fonctionner GuaTec et sauvegarder votre progression, nous traitons votre identifiant de compte, votre progression et l'état sauvegardé des missions, les décisions, ressources, échantillons, résultats et indicateurs d'utilisation de la simulation, ainsi que les dates de début ou de fin lorsqu'elles sont générées.",
              "Votre navigateur stocke la langue, un nom d'utilisateur en cache, un jeton d'accès à durée limitée et, lors de l'inscription par OAuth, temporairement l'adresse e-mail en attente. L'hébergeur peut produire des journaux techniques de requêtes, tels que l'adresse IP, la date, les informations du navigateur et les erreurs.",
            ],
          },
          {
            title: "2. Finalités et bases légales",
            paragraphs: [
              "Les données servent à créer et sécuriser les comptes, se connecter, vérifier l'identité, sauvegarder et restaurer la progression, afficher les rapports et statistiques, prévenir les abus et maintenir le service. Les bases légales dépendent du pays et peuvent inclure la fourniture de la fonctionnalité demandée, le consentement lorsqu'il est requis et les intérêts légitimes liés à la sécurité et à la maintenance, sous réserve de vos droits.",
              "Les données personnelles ne sont pas vendues et le code de GuaTec ne met pas en œuvre de publicité personnalisée. Ne saisissez pas de données sensibles ou concernant des tiers dans les noms d'utilisateur, adresses e-mail ou autres champs.",
            ],
          },
          {
            title: "3. Prestataires et transferts",
            paragraphs: [
              "GuaTec utilise Vercel pour servir le site et exécuter l'API, et Supabase/PostgreSQL pour stocker les données si la base de production est activée. Google ou GitHub reçoivent des requêtes lorsque vous choisissez l'une de ces méthodes de connexion et traitent les données selon leurs propres politiques. L'API peut interroger les services publics de la NASA pour obtenir des ressources et informations spatiales ; ces requêtes ne nécessitent pas de transmettre à la NASA votre mot de passe ou votre progression. Si votre navigateur charge des ressources hébergées par des tiers, ces prestataires peuvent recevoir les données techniques habituelles de connexion.",
              "Ces prestataires peuvent traiter des informations dans les pays où se trouvent leurs centres de données. Consultez leurs politiques et paramètres pour connaître les lieux, conditions de transfert et durées de conservation.",
            ],
          },
          {
            title: "4. Stockage et conservation",
            paragraphs: [
              "Le jeton d'accès et les préférences de GuaTec sont enregistrés dans le stockage local du navigateur, et non dans un cookie de suivi. Le jeton permet d'utiliser la session et expire selon la configuration du serveur. Vous pouvez vous déconnecter pour supprimer le jeton et effacer les données locales du navigateur ; cela ne supprime pas la progression déjà enregistrée sur le serveur.",
              "Les données et progressions liées à votre compte sont conservées tant que le compte est actif ou qu'elles sont nécessaires au service. Pour en demander la suppression, écrivez à l'adresse de contact depuis l'adresse e-mail associée au compte et indiquez votre nom d'utilisateur. La demande sera vérifiée et les données pouvant être effacées le seront, à l'exception de celles à conserver pour la sécurité, les obligations légales ou les sauvegardes pendant leur cycle normal.",
            ],
          },
          {
            title: "5. Vos droits et demandes",
            paragraphs: [
              "Selon le droit applicable, vous pouvez demander l'accès, la rectification, l'effacement, la portabilité ou la limitation du traitement, vous y opposer ou retirer votre consentement. Vous pouvez également saisir l'autorité compétente en matière de protection des données. Utilisez les moyens de contact ci-dessous pour exercer ces droits ou signaler un problème de confidentialité.",
            ],
          },
          {
            title: "6. Mineurs et modifications",
            paragraphs: [
              "GuaTec est éducatif ; il ne demande pas délibérément de données sensibles et n'est pas conçu pour publier des informations personnelles. Si vous êtes mineur, utilisez GuaTec sous la supervision d'un adulte lorsque la législation locale l'exige. Un parent ou tuteur qui estime que les données d'un mineur ont été fournies de manière inappropriée peut en demander l'examen ou la suppression.",
              "Cette politique peut être mise à jour en cas de modification du code, des prestataires ou des obligations légales. La date indiquée ci-dessus identifie la version publiée.",
            ],
          },
        ],
      },
      terms: {
        title: "Conditions générales d’utilisation",
        introduction:
          "En accédant à GuaTec, vous acceptez ces conditions. Si vous n'êtes pas d'accord, ne créez pas de compte et n'utilisez pas le service.",
        sections: [
          {
            title: "1. GuaTec",
            paragraphs: [
              "GuaTec est une simulation éducative d'exploration spatiale. Ses scènes, décisions, chronologie, résultats et systèmes sont des représentations narratives ou des systèmes de simulation ; ils ne constituent ni des données scientifiques, ni des prévisions, ni des instructions professionnelles. Les références historiques et ressources tierces restent soumises à leurs attributions et conditions respectives.",
              "GuaTec est indépendant et n'est ni affilié, ni financé, ni approuvé par la NASA. Les noms et références de la NASA identifient des sources ou des sujets connexes, et non un partenariat institutionnel.",
            ],
          },
          {
            title: "2. Comptes et utilisation acceptable",
            paragraphs: [
              "Fournissez des informations de connexion exactes, gardez votre mot de passe confidentiel et signalez tout accès non autorisé suspecté. Vous êtes responsable de l'activité effectuée sur votre compte tant que vous le contrôlez.",
            ],
            bullets: [
              "Utilisez GuaTec conformément à la loi et ne tentez pas d'accéder à des comptes, données ou systèmes sans autorisation.",
              "Ne perturbez pas le service, n'introduisez pas de code malveillant et ne contournez pas les mesures de sécurité.",
              "N'utilisez pas les noms d'utilisateur ou profils pour usurper une identité, harceler ou divulguer des informations personnelles.",
              "Ne présentez pas les simulations ou décisions comme des instructions réelles pour construire, lancer ou utiliser du matériel.",
            ],
          },
          {
            title: "3. Propriété intellectuelle et services tiers",
            paragraphs: [
              "Le code, l'identité visuelle et les contenus originaux de GuaTec appartiennent à leurs titulaires et sont proposés conformément aux licences applicables. Les ressources de la NASA, de Poly Haven, des fournisseurs de connexion et d'autres tiers restent soumises à leurs propres droits et conditions ; leur mention ne transfère aucun droit et ne signifie aucun soutien.",
              "La connexion via Google ou GitHub et l'hébergement/la base de données dépendent de services externes. Leur disponibilité et le traitement des données sont également régis par les conditions et politiques de ces prestataires.",
            ],
          },
          {
            title: "4. Disponibilité, modifications et responsabilité",
            paragraphs: [
              "GuaTec est fourni dans son état actuel et peut être modifié, interrompu ou arrêté, avec ou sans préavis, dans les limites prévues par la loi. Malgré les efforts visant à protéger la progression sauvegardée, sa disponibilité permanente et l'absence d'interruptions ou de pertes ne sont pas garanties.",
              "Dans la mesure maximale autorisée par la loi, les personnes qui maintiennent GuaTec ne sont pas responsables des dommages indirects résultant de l'utilisation ou de l'indisponibilité de la simulation, ni des décisions fondées sur son contenu. Aucune disposition n'exclut les droits ou responsabilités légalement inaliénables.",
            ],
          },
          {
            title: "5. Suspension, confidentialité et modifications",
            paragraphs: [
              "L'accès peut être suspendu en cas de violation de ces conditions, de risque pour le service ou d'obligation légale. Le traitement des données est décrit dans la Politique de confidentialité accessible sur cette page.",
              "Ces conditions peuvent changer pour tenir compte d'améliorations, de nouvelles fonctionnalités ou d'obligations légales. Toute modification importante sera indiquée par une date de révision actualisée. La poursuite de l'utilisation après publication des nouvelles conditions vaut acceptation dans les limites du droit applicable.",
            ],
          },
          {
            title: "6. Droit applicable et contact",
            paragraphs: [
              "Les protections légales impératives et les droits des consommateurs de votre lieu de résidence s'appliquent lorsqu'ils sont pertinents. Toute question relative à ces conditions peut être envoyée via les moyens de contact ci-dessous.",
            ],
          },
        ],
      },
      contact: {
        title: "Contact",
        introduction:
          "Une question sur GuaTec, un compte, vos données personnelles ou ces conditions ? Consultez les moyens de contact de l'équipe GuaTec.",
        sections: [
          {
            title: "Confidentialité et comptes",
            paragraphs: [
              "Pour demander l'accès, la rectification ou la suppression de données, indiquez l'adresse e-mail associée au compte et, le cas échéant, votre nom d'utilisateur. N'envoyez pas de mot de passe ni de jeton de session. La propriété du compte peut devoir être vérifiée avant traitement.",
            ],
          },
          {
            title: "Retours sur GuaTec",
            paragraphs: [
              "Vous pouvez également signaler un problème d'accessibilité, une attribution inexacte ou une erreur dans le contenu éducatif. Décrivez l'écran ou le sujet concerné sans communiquer d'informations sensibles.",
            ],
          },
        ],
      },
    },
  },
};

function isLanguage(value: string | null): value is Language {
  return value !== null && LANGUAGES.includes(value as Language);
}

function isDocument(value: string | null): value is DocumentId {
  return value !== null && DOCUMENTS.includes(value as DocumentId);
}

const params = new URLSearchParams(window.location.search);
const requestedLanguage = params.get("lang");
const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
const requestedDocument = params.get("document");
let language: Language = isLanguage(requestedLanguage)
  ? requestedLanguage
  : isLanguage(storedLanguage)
    ? storedLanguage
    : "es";
let documentId: DocumentId = isDocument(requestedDocument) ? requestedDocument : "privacy";

const root: HTMLElement = (() => {
  const element = document.querySelector<HTMLElement>("#legal-app");
  if (!element) throw new Error("Missing #legal-app in legal.html");
  return element;
})();

function documentUrl(nextDocument: DocumentId, nextLanguage: Language): string {
  const url = new URL("/legal.html", window.location.origin);
  url.searchParams.set("document", nextDocument);
  url.searchParams.set("lang", nextLanguage);
  return `${url.pathname}${url.search}`;
}

function updateUrl(): void {
  window.history.replaceState(null, "", documentUrl(documentId, language));
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
}

function appendText(
  parent: HTMLElement,
  tag: string,
  className: string,
  text: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function render(): void {
  const strings = copy[language];
  const page = strings.pages[documentId];
  document.title = `${page.title} · ${strings.project}`;
  document.documentElement.lang = language;
  root.replaceChildren();

  const main = document.createElement("main");
  main.className = "legal-shell container py-4 py-lg-5";
  const card = document.createElement("article");
  card.className = "legal-card card border-0 shadow-lg overflow-hidden";
  const body = document.createElement("div");
  body.className = "card-body p-4 p-md-5";

  const masthead = document.createElement("header");
  masthead.className =
    "legal-masthead d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3";
  const brand = document.createElement("a");
  brand.className = "legal-brand";
  brand.href = "/";
  brand.textContent = strings.project;
  masthead.append(brand);

  const languageControl = document.createElement("div");
  languageControl.className = "legal-language";
  const languageLabel = document.createElement("span");
  languageLabel.className = "legal-language-label";
  languageLabel.textContent = strings.languageLabel;
  languageControl.append(languageLabel);

  const languageGroup = document.createElement("div");
  languageGroup.className = "btn-group flex-wrap";
  languageGroup.setAttribute("role", "group");
  languageGroup.setAttribute("aria-label", strings.languageLabel);
  LANGUAGES.forEach((option) => {
    const button = document.createElement("button");
    button.className = `btn btn-sm ${
      language === option ? "btn-warning" : "btn-outline-light"
    }`;
    button.type = "button";
    button.textContent = strings.languages[option];
    button.setAttribute("aria-pressed", String(language === option));
    button.addEventListener("click", () => {
      language = option;
      updateUrl();
      render();
    });
    languageGroup.append(button);
  });
  languageControl.append(languageGroup);
  masthead.append(languageControl);
  body.append(masthead);

  const intro = document.createElement("section");
  intro.className = "legal-intro py-4 py-md-5";
  appendText(intro, "span", "badge rounded-pill text-bg-warning mb-3", strings.project);
  appendText(intro, "h1", "display-5 fw-bold mb-3", page.title);
  appendText(intro, "p", "legal-lead lead mb-3", page.introduction);
  appendText(intro, "p", "legal-updated small mb-0", strings.lastUpdated);
  body.append(intro);

  const nav = document.createElement("nav");
  nav.className = "legal-nav nav nav-pills gap-2 mb-4";
  nav.setAttribute("aria-label", strings.project);
  DOCUMENTS.forEach((item) => {
    const link = document.createElement("a");
    link.className = `nav-link ${documentId === item ? "active" : ""}`;
    link.href = documentUrl(item, language);
    link.textContent = strings.documents[item];
    if (documentId === item) link.setAttribute("aria-current", "page");
    nav.append(link);
  });
  body.append(nav);

  const sections = document.createElement("div");
  sections.className = "legal-sections";
  page.sections.forEach((section) => {
    const sectionElement = document.createElement("section");
    sectionElement.className = "legal-section";
    appendText(sectionElement, "h2", "h5 fw-semibold mb-3", section.title);
    section.paragraphs?.forEach((paragraph) => {
      appendText(sectionElement, "p", "legal-paragraph", paragraph);
    });
    if (section.bullets) {
      const list = document.createElement("ul");
      list.className = "legal-list";
      section.bullets.forEach((bullet) => appendText(list, "li", "", bullet));
      sectionElement.append(list);
    }
    sections.append(sectionElement);
  });
  body.append(sections);

  if (documentId === "contact") {
    const contact = document.createElement("section");
    contact.className = "legal-contact card mt-4";
    contact.setAttribute("aria-label", strings.contactLinksLabel);
    const contactBody = document.createElement("div");
    contactBody.className = "card-body legal-people";
    TEAM_MEMBERS.forEach((member) => {
      const person = document.createElement("article");
      person.className = "legal-person card";
      const personBody = document.createElement("div");
      personBody.className = "card-body";
      appendText(personBody, "h2", "h6 fw-semibold mb-3", member.name);

      const role = document.createElement("p");
      role.className = "legal-contact-field legal-role-field";
      appendText(role, "strong", "legal-contact-label", `${strings.roleLabel}:`);
      const blankRole = document.createElement("span");
      blankRole.className = "legal-contact-value";
      blankRole.setAttribute("aria-label", strings.pendingLabel);
      role.append(blankRole);

      const email = document.createElement("p");
      email.className = "legal-contact-field";
      appendText(email, "strong", "legal-contact-label", `${strings.emailLabel}:`);
      if (member.email) {
        const link = document.createElement("a");
        link.className = "legal-contact-value";
        link.href = `mailto:${member.email}`;
        link.textContent = member.email;
        email.append(link);
      } else {
        appendText(email, "span", "legal-contact-value", strings.pendingLabel);
      }

      const instagram = document.createElement("p");
      instagram.className = "legal-contact-field mb-0";
      appendText(instagram, "strong", "legal-contact-label", `${strings.instagramLabel}:`);
      if (member.instagramUrl && member.instagramHandle) {
        const link = document.createElement("a");
        link.className = "legal-contact-value";
        link.href = member.instagramUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = member.instagramHandle;
        instagram.append(link);
      } else {
        appendText(instagram, "span", "legal-contact-value", strings.pendingLabel);
      }

      personBody.append(role, email, instagram);
      person.append(personBody);
      contactBody.append(person);
    });
    contact.append(contactBody);
    body.append(contact);
  }

  const footer = document.createElement("footer");
  footer.className =
    "legal-footer d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-5 pt-4";
  appendText(footer, "p", "small mb-0", strings.footer);
  const home = document.createElement("a");
  home.className = "btn btn-warning btn-sm align-self-start align-self-md-center";
  home.href = "/";
  home.textContent = strings.backToProject;
  footer.append(home);
  body.append(footer);

  const disclaimer = document.createElement("p");
  disclaimer.className = "legal-disclaimer small mt-4 mb-0";
  disclaimer.textContent = strings.projectDisclaimer;
  body.append(disclaimer);

  card.append(body);
  main.append(card);
  root.append(main);
}

window.addEventListener("popstate", () => {
  const nextParams = new URLSearchParams(window.location.search);
  const nextDocument = nextParams.get("document");
  const nextLanguage = nextParams.get("lang");
  if (isDocument(nextDocument)) documentId = nextDocument;
  if (isLanguage(nextLanguage)) language = nextLanguage;
  render();
});

updateUrl();
render();
