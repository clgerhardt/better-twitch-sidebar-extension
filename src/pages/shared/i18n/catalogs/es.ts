// Spanish. A draft: have a native speaker review it before release. Terms follow what Twitch itself says in
// Spanish ("canales que sigo", "en directo", "espectadores"). Typed against the English keys, so a missing or
// extra key does not compile.
import type { Catalog } from "../catalog.en";

const es: Catalog = {
  // Popup
  "banner.tagline": "¡Agrupa a tu manera!",
  "popup.incognito": "Esta extensión no funciona en el modo incógnito. Desactívala en la configuración del navegador o usa una ventana normal.",
  "popup.connected": "Conectado",
  "popup.logout": "Cerrar sesión",
  "popup.signedOut": "Has cerrado sesión en Twitch. Inicia sesión en Twitch para usar tus grupos; están guardados y volverán cuando lo hagas.",
  "popup.expired": "La conexión de la extensión con Twitch ha caducado. Vuelve a conectar para ver tus grupos; están guardados.",
  "popup.hideSections": "Ocultar secciones",
  "popup.hideSections.count": { one: "{count} activada", many: "{count} activadas", other: "{count} activadas" },
  "popup.hide.originalFollowers": "Ocultar la lista original de canales seguidos",
  "popup.hide.stories": "Ocultar historias",
  "popup.hide.live": "Ocultar canales en directo",
  "popup.hide.streaks": "Ocultar rachas",
  "popup.hide.categories": "Ocultar categorías recomendadas",
  "popup.hide.viewersAlsoWatch": 'Ocultar "los espectadores también ven"',
  "popup.sync.on": "Los grupos se sincronizan entre tus dispositivos",
  "popup.sync.onHint": "Mediante la sincronización de Chrome: inicia sesión en Chrome con la sincronización de extensiones activada.",
  "popup.sync.off": "La sincronización de grupos está desactivada",
  "popup.sync.offHint": "Los cambios se quedan en este dispositivo. Al volver a activarla, se sustituyen por tus grupos sincronizados.",
  "popup.sync.turnOff": "Desactivar",
  "popup.sync.turnOn": "Activar",

  // Connecting to Twitch
  "guest.signedIn": "Has iniciado sesión en Twitch como {login}. Conecta la extensión para usar tus grupos.",
  "guest.signedOut": "Inicia sesión en Twitch en una pestaña y luego conecta la extensión para usar tus grupos.",
  "guest.default": "Abre Twitch en una pestaña e inicia sesión; luego conecta la extensión para usar tus grupos.",
  "connect.wrongAccount": "Esa no es la cuenta con la sesión iniciada en Twitch. Inicia sesión en Twitch con la cuenta que quieras y vuelve a intentarlo.",
  "connect.notSignedIn": "Primero inicia sesión en Twitch en una pestaña.",
  "connect.failed": "No se pudo conectar con Twitch. Inténtalo de nuevo.",
  "connect.button": "Conectar para {login}",
  "connect.waiting": "Esperando a Twitch...",
  "connect.reconnect": "Volver a conectar",
  "connect.checking": "Comprobando la conexión...",

  // The sidebar
  "sidebar.loading": "Cargando grupos y canales...",
  "sidebar.syncing": "Sincronizando tus grupos...",
  "sidebar.error": "Error al cargar los grupos: {error}",
  "sidebar.error.fetchFailed": "No se pudieron obtener los canales seguidos",
  "sidebar.error.expired": "El inicio de sesión de Twitch ha caducado. Vuelve a conectar desde la ventana de la extensión.",
  "sidebar.notConnected": "Conecta para agrupar los canales que sigues",
  "sidebar.notConnected.unknownAccount": "No se pudo saber qué cuenta de Twitch tiene la sesión iniciada",
  "sidebar.expired": "La conexión de la extensión ha caducado",
  "sidebar.signedOut": "Inicia sesión en Twitch para ver tus grupos",
  "sidebar.noChannels": "Sin canales",
  "sidebar.noChannelsToShow": "No hay canales que mostrar",
  "sidebar.liveOf": "{live} en directo de {total}",
  "sidebar.liveCount": "{count} en directo",
  "manage.button": "Gestionar grupos",
  "group.default.name": "Sin grupo",

  // The rows we build inside Twitch's list
  "row.offline": "Sin conexión",
  "row.live": "En directo",
  "row.viewers": { one: "{count} espectador", many: "{count} de espectadores", other: "{count} espectadores" },

  // Manage groups dialog
  "dialog.title": "Gestionar grupos",
  "dialog.close": "Cerrar",
  "dialog.groups": "Grupos",
  "dialog.channels": "Canales",
  "dialog.groupName": "Nombre del grupo",
  "dialog.addPlaceholder": "Añadir grupo",
  "dialog.add": "Añadir",
  "dialog.default": "Predeterminado",
  "dialog.moveUp": "Mover {name} hacia arriba",
  "dialog.moveDown": "Mover {name} hacia abajo",
  "dialog.renamePlaceholder": "Nuevo nombre",
  "dialog.newGroupName": "Nuevo nombre del grupo",
  "dialog.makeDefault": "Hacer predeterminado",
  "dialog.confirmDelete": "¿Seguro?",
  "dialog.color": "Color",
  "dialog.colorGroup": "Color del grupo",
  "dialog.colorCustom": "Color personalizado",
  "dialog.colorChoice": "Color {name}",
  "color.purple": "Morado",
  "color.red": "Rojo",
  "color.orange": "Naranja",
  "color.yellow": "Amarillo",
  "color.green": "Verde",
  "color.teal": "Turquesa",
  "color.blue": "Azul",
  "color.pink": "Rosa",
  "dialog.defaultInfo": "{name} es el grupo predeterminado: los canales sin grupo van aquí y no se puede eliminar. Marca un canal para moverlo a {name}; un canal sale de él cuando lo marcas en otro grupo.",
  "dialog.tickInfo": "Marca los canales que pertenecen a {name}.",
  "dialog.search": "Buscar canales",
  "dialog.leaveHint": "Para sacarlo de {name}, márcalo en otro grupo",
  "dialog.noMatch": 'Ningún canal coincide con "{query}"',

  // Group names
  "groupName.blank": "El nombre del grupo no puede estar vacío",
  "groupName.tooLong": "El nombre del grupo no puede tener más de {max} caracteres",
  "groupName.exists": "Ya existe un grupo con ese nombre",
  "groupName.tooShort": "El nombre del grupo debe tener al menos {min} caracteres",
  "groupName.profanity": "El nombre del grupo contiene lenguaje no permitido",
};

export default es;
