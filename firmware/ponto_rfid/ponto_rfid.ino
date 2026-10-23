#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

#define SS_PIN       5
#define RST_PIN      22
#define LED_VERDE    2
#define LED_VERMELHO 4
#define SERVO_PIN    13

// Tempo máximo esperando OPEN/DENY do sistema React depois de ler um crachá.
// Sem resposta, o acesso é negado por segurança.
#define TIMEOUT_RESPOSTA_MS 2000

MFRC522 rfid(SS_PIN, RST_PIN);
Servo catraca;

String rxBuffer = "";
bool respostaRecebida = false;

void liberarAcesso() {
  digitalWrite(LED_VERDE, HIGH);
  catraca.write(90); // Libera a catraca
  delay(3000);
  catraca.write(0);  // Tranca a catraca
  digitalWrite(LED_VERDE, LOW);
}

void negarAcesso() {
  digitalWrite(LED_VERMELHO, HIGH);
  delay(2000);
  digitalWrite(LED_VERMELHO, LOW);
}

// Executa o comando recebido do React: "OPEN" ou "DENY"
void processarComando(String cmd) {
  cmd.trim();
  if (cmd == "OPEN") {
    respostaRecebida = true;
    liberarAcesso();
  } else if (cmd == "DENY") {
    respostaRecebida = true;
    negarAcesso();
  }
}

// Lê a serial sem bloquear e monta as linhas terminadas em '\n'
void checarSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      processarComando(rxBuffer);
      rxBuffer = "";
    } else if (c != '\r') {
      rxBuffer += c;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Inicialização da comunicação SPI com o MFRC522
  SPI.begin(18, 19, 23, 5);
  rfid.PCD_Init();

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);

  // Inicializa o servomotor (catraca travada)
  catraca.attach(SERVO_PIN);
  catraca.write(0);

  Serial.println("ESP32_PRONTO");
}

void loop() {
  // Comandos vindos do React (inclui o botão "Liberar Catraca" do painel)
  checarSerial();

  // Aguarda a aproximação de um crachá no leitor MFRC522
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(100);
    return;
  }

  // Leitura da UID do crachá
  String uidLida = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uidLida += String(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    uidLida += String(rfid.uid.uidByte[i], HEX);
  }
  uidLida.toUpperCase();
  uidLida.trim();

  // Envia o código lido via Serial para o sistema
  Serial.print("UID_LIDA:");
  Serial.println(uidLida);

  // Espera a decisão do React (OPEN ou DENY) em vez de liberar sempre
  respostaRecebida = false;
  unsigned long inicio = millis();
  while (!respostaRecebida && millis() - inicio < TIMEOUT_RESPOSTA_MS) {
    checarSerial();
    delay(10);
  }
  if (!respostaRecebida) {
    negarAcesso(); // sistema não respondeu a tempo
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(1500);
}
