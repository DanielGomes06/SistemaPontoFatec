# Sistema de Controle de Acesso RFID — FATEC Itapira

Painel em React (Vite + Tailwind CSS) que se comunica com um ESP32 + leitor MFRC522 pela
**Web Serial API** e guarda crachás e registros de acesso no **Firebase Realtime Database**.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173) no
**Google Chrome, Microsoft Edge ou Brave**. A Web Serial API não funciona no Firefox/Safari.

Para publicar no Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## Ligações (ESP32 DevKit V1)

| Componente | Pino do componente | ESP32 |
|---|---|---|
| MFRC522 | SDA (SS) | D5 |
| MFRC522 | SCK | D18 |
| MFRC522 | MOSI | D23 |
| MFRC522 | MISO | D19 |
| MFRC522 | RST | D22 |
| MFRC522 | 3.3V | 3V3 (nunca 5 V) |
| MFRC522 | GND | GND |
| Servo (catraca) | Sinal | D13 |
| Servo (catraca) | V+ | VIN (5 V) |
| Servo (catraca) | GND | GND |

Todos os GND ficam ligados juntos.

## Protocolo serial (115200 baud)

| Sentido        | Mensagem            | Significado                              |
|----------------|---------------------|------------------------------------------|
| ESP32 → React  | `UID_LIDA:<UID>\n`  | Um crachá foi lido (ex.: `UID_LIDA:A1 B2 C3 D4`) |
| React → ESP32  | `OPEN\n`            | Acesso liberado (UID cadastrado): o servo abre a catraca por 3 s |
| React → ESP32  | `DENY\n`            | Acesso negado: a catraca continua trancada |

O ESP32 também escreve `ESP32_PRONTO`, `ACESSO_LIBERADO` e `ACESSO_NEGADO`, que aparecem no
terminal do painel. A catraca só abre quando chega `OPEN`; sem resposta do painel, ela fica trancada.
A comparação de UID ignora maiúsculas/minúsculas, espaços, `:` e `-`
(`a1:b2:c3:d4` equivale a `A1 B2 C3 D4`).

## Firebase

Configuração em `src/firebase.js`. Estrutura do banco:

```
usuarios/<id>   -> name, role, uid
acessos/<id>    -> name, role, uid, timestamp, authorized
```

As regras do banco estão em modo de teste (expiram em ~30 dias). Depois disso, renove em
Realtime Database > Regras ou ative Authentication.

## Firmware e Wokwi

Arquivos do ESP32 em `firmware/`:

- `ponto_rfid/ponto_rfid.ino`: sketch para o Arduino IDE (placa **ESP32 Dev Module**; bibliotecas
  **MFRC522** e **ESP32Servo**). O mesmo código vai no `sketch.ino` do Wokwi.
- `diagram.json` e `libraries.txt`: circuito e bibliotecas do Wokwi.

O Wokwi rodando no navegador **não aparece como porta serial** para a Web Serial API, então o painel
não conecta nele. Para testar o firmware no Wokwi:

1. Inicie a simulação e clique no leitor MFRC522 para escolher um cartão e tocar nele (**Tap**).
   O cartão azul tem UID `01 02 03 04`.
2. O Monitor Serial mostra `UID_LIDA:01 02 03 04`.
3. Digite `OPEN` ou `DENY` no Monitor Serial e envie, no lugar do painel.

Para testar o painel de ponta a ponta, use o ESP32 físico por USB.

## Estrutura

```
index.html
package.json
vite.config.js
firebase.json / .firebaserc   # Firebase Hosting
src/
  main.jsx     # ponto de entrada
  index.css    # importa o Tailwind
  firebase.js  # inicialização do Firebase
  App.jsx      # painel de controle de acesso
firmware/
  ponto_rfid/ponto_rfid.ino   # sketch do ESP32 (Arduino IDE / Wokwi)
  diagram.json                # circuito do Wokwi
  libraries.txt               # bibliotecas do Wokwi
```
