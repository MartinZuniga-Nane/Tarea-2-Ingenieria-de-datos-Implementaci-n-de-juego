export function createResultCopy(result) {
  if (!result) {
    return {
      title: "Duelo listo",
      subtitle: "Inicia una partida para ver el resultado.",
    };
  }

  if (!result.winner) {
    return {
      title: "Empate tenso",
      subtitle: result.reason === "timeout" ? "Nadie disparo a tiempo." : "La ronda termino sin vencedor claro.",
    };
  }

  return {
    title: `${result.winner.label} gana`,
    subtitle: result.reason === "false-start" ? "El rival disparo fuera de ventana." : "Fue el disparo valido mas rapido.",
  };
}
