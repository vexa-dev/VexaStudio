export interface EmojiEntry {
  char: string;
  /** Space-separated Spanish keywords, unaccented lowercase. */
  keywords: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  emojis: EmojiEntry[];
}

export const RECENT_LIMIT = 16;

function list(source: string): EmojiEntry[] {
  return source
    .trim()
    .split("\n")
    .map((line) => {
      const [char, ...words] = line.trim().split(" ");
      return { char, keywords: words.join(" ") };
    });
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "faces",
    label: "Caras",
    emojis: list(`
😀 sonrisa feliz alegre
😃 contento feliz sonrisa
😄 risa feliz alegre
😁 sonriente contento
😆 risa carcajada
😅 alivio sudor risa
😂 risa lagrimas gracioso
🙂 sonrisa amable
😉 guino complicidad
😊 agradecido sonrojo feliz
😍 encanta enamorado
😘 beso carino
😋 rico delicioso
😎 genial gafas
🤩 asombro estrellas
🥳 fiesta celebrar
🤔 pensando duda
🤨 escepticismo ceja
😐 neutral serio
🙄 fastidio ojos
😏 picaro
😌 alivio calma tranquilo
😴 sueno dormir cansado
😢 triste llorar
😭 llanto triste
😡 enojo molesto
🤯 explota mente sorpresa
😱 miedo susto
😳 vergüenza sonrojado
🥲 conmovido triste sonrisa
🤗 abrazo
😇 angel bueno
`),
  },
  {
    id: "gestures",
    label: "Gestos y personas",
    emojis: list(`
👍 bien aprobado ok like
👎 mal no rechazo
👏 aplausos bravo
🙌 celebrar manos arriba
🙏 gracias por favor rezar
🤝 acuerdo trato socios
💪 fuerza animo
✌️ paz victoria
🤞 suerte dedos cruzados
👌 perfecto ok
🤙 llamame
👋 hola saludo adios
✋ alto mano
🖐️ mano abierta
☝️ arriba uno
👉 derecha apuntar
👈 izquierda apuntar
👇 abajo apuntar
👆 arriba apuntar
✍️ escribir firma
🫶 carino manos corazon
👀 ojos mirar revisar
🧠 cerebro idea mente
🫡 saludo respeto
🙋 levantar mano pregunta
🙆 de acuerdo
🤷 no se duda
🤦 error facepalm
💁 informacion ayuda
🧑‍💻 desarrollador programar codigo
👩‍💻 desarrolladora programar codigo
🧑‍🎨 diseno diseñador artista
🧑‍💼 oficina gerente jefe
`),
  },
  {
    id: "work",
    label: "Trabajo y objetos",
    emojis: list(`
💻 computadora laptop codigo
🖥️ pantalla escritorio
⌨️ teclado
🖱️ mouse raton
📱 celular telefono movil
📞 llamada telefono
📧 correo email
📎 adjunto clip
📌 fijar chincheta
📁 carpeta
📄 documento pagina
📊 grafico reporte datos
📈 crecimiento sube
📉 baja caida
📅 calendario fecha
🗓️ agenda calendario reunion
⏰ alarma hora
⏳ espera tiempo
🕒 hora reloj
✅ listo hecho completado
☑️ marcado check
❌ error cancelar no
⚠️ advertencia cuidado
🔒 candado seguro privado
🔑 llave acceso
🔧 herramienta arreglar
⚙️ ajustes configuracion
🧩 pieza integrar
💡 idea
🎯 objetivo meta
🚀 lanzamiento cohete
🏆 trofeo logro
📣 anuncio aviso
💬 mensaje chat
💰 dinero plata
🧾 recibo gasto factura
`),
  },
  {
    id: "nature",
    label: "Naturaleza y comida",
    emojis: list(`
☕ cafe
🍵 te infusion
🥐 desayuno croissant
🍕 pizza
🍔 hamburguesa
🌮 taco
🥗 ensalada
🍜 sopa fideos
🍣 sushi
🍰 pastel torta postre
🍪 galleta
🍎 manzana fruta
🍌 platano banana fruta
🍓 fresa fruta
🍉 sandia fruta
🥑 palta aguacate
🍺 cerveza
🥂 brindis celebrar
🌱 brote crecimiento planta
🌿 hoja planta
🌳 arbol
🌸 flor
🌞 sol dia
🌙 luna noche
⭐ estrella
🌈 arcoiris
⚡ rayo energia rapido
🔥 fuego tendencia
💧 gota agua
❄️ frio nieve
🌊 ola mar
🐶 perro
🐱 gato
🦙 llama peru
`),
  },
  {
    id: "symbols",
    label: "Símbolos",
    emojis: list(`
❤️ corazon amor
🧡 corazon naranja
💛 corazon amarillo
💚 corazon verde
💙 corazon azul
💜 corazon morado
🖤 corazon negro
🤍 corazon blanco
💔 corazon roto
✨ brillo magia nuevo
🎉 fiesta celebracion
🎊 confeti celebracion
🎈 globo
🎁 regalo
💯 cien perfecto
➕ mas sumar
➖ menos restar
✔️ correcto check
✖️ cruz multiplicar
❓ pregunta
❗ exclamacion importante
‼️ muy importante
💤 sueno descanso
🔔 notificacion campana
🔕 silencio
🔁 repetir
🔄 actualizar sincronizar
⬆️ subir
⬇️ bajar
➡️ siguiente derecha
⬅️ anterior izquierda
🆗 ok
🆕 nuevo
🔴 rojo circulo
🟢 verde circulo
🟡 amarillo circulo
`),
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const ALL = EMOJI_CATEGORIES.flatMap((category) => category.emojis);

/** Accent- and case-insensitive match on Spanish keywords; blank returns []. */
export function searchEmojis(query: string): EmojiEntry[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return ALL.filter((entry) => {
    const haystack = normalize(entry.keywords);
    return terms.every((term) => haystack.includes(term));
  });
}

/** Returns a new recents list with `emoji` first, deduplicated and capped. */
export function pushRecent(
  list: string[],
  emoji: string,
  max = RECENT_LIMIT,
): string[] {
  return [emoji, ...list.filter((item) => item !== emoji)].slice(0, max);
}
