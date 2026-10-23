# Sistema de Controle de Acesso RFID — FATEC Itapira

Painel em React (Vite + Tailwind CSS) que se comunica com um ESP32 + leitor MFRC522
pela **Web Serial API**.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173) no
**Google Chrome, Microsoft Edge ou Brave**. A Web Serial API não funciona no Firefox/Safari.

## Protocolo serial (115200 baud)

| Sentido        | Mensagem            | Significado                              |
|----------------|---------------------|------------------------------------------|
| ESP32 → React  | `UID_LIDA:<UID>\n`  | Um crachá foi lido (ex.: `UID_LIDA:A1 B2 C3 D4`) |
| React → ESP32  | `OPEN\n`            | Acesso liberado (UID cadastrado e ativo) |
| React → ESP32  | `DENY\n`            | Acesso negado                            |

O firmware do ESP32 precisa usar exatamente esse formato. Cada mensagem termina com `\n`.
A comparação de UID ignora maiúsculas/minúsculas, espaços, `:` e `-`
(`a1:b2:c3:d4` equivale a `A1 B2 C3 D4`).

## Uso com o Wokwi

Arquivos do ESP32 em `firmware/`: `ponto_rfid/ponto_rfid.ino` (sketch), `diagram.json` e `libraries.txt`.

O firmware envia `UID_LIDA:<UID>` e **espera** `OPEN` ou `DENY` do painel (até 2 s; sem resposta, nega).

O simulador do Wokwi rodando no navegador **não aparece como porta serial** para a Web Serial API.
Opções para testar o painel:

- ESP32 físico por USB, com o mesmo sketch e ligações;
- Wokwi para VS Code com `rfc2217ServerPort = 4000` no `wokwi.toml`. Isso expõe a serial por TCP
  (RFC2217), que o navegador não abre diretamente, então é preciso uma ponte (por exemplo, uma
  porta serial virtual ou um bridge WebSocket) entre o TCP e o painel.

## Estrutura

```
index.html
package.json
vite.config.js
src/
  main.jsx     # ponto de entrada
  index.css    # importa o Tailwind
  App.jsx      # painel de controle de acesso
firmware/
  ponto_rfid/ponto_rfid.ino   # sketch do ESP32 (Wokwi / placa real)
  diagram.json                # circuito do Wokwi
  libraries.txt               # bibliotecas do Wokwi
```

## Observações

- Os crachás cadastrados ficam apenas na memória: ao recarregar a página, voltam aos 3 de exemplo.
