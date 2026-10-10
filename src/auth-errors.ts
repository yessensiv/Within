type AuthAction = "login" | "register" | "forgot";

export function authErrorMessage(error: unknown, action: AuthAction): string {
  const detail = error && typeof error === "object"
    ? error as { code?: string; status?: number; name?: string }
    : {};
  if (detail.code === "over_email_send_rate_limit")
    return "Лимит отправки писем временно исчерпан. Проверь уже полученное письмо или попробуй позже.";
  if (detail.code === "over_request_rate_limit" || detail.status === 429)
    return "Слишком много запросов. Подожди немного и попробуй снова. Если письмо уже пришло, используй ссылку в нём.";
  if (detail.code === "email_not_confirmed")
    return "Подтверди email по ссылке из письма, затем войди снова.";
  if (detail.code === "email_address_not_authorized")
    return "Почтовая служба пока не настроена для этого адреса. Для отправки писем нужно подключить почту проекта.";
  if (detail.name === "AuthRetryableFetchError" || error instanceof TypeError)
    return "Не удалось связаться с сервером. Проверь соединение и попробуй снова.";
  return action === "login"
    ? "Не удалось войти. Проверь email и пароль."
    : action === "forgot"
      ? "Не удалось отправить письмо. Попробуй позже."
      : "Не удалось зарегистрироваться. Проверь данные и попробуй снова.";
}
