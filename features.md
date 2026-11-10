# Features

1. **Erstellung eines Quiz-Raums**  
   Die Spielleitung kann einen neuen Quiz-Raum erstellen. Dabei wird automatisch ein eindeutiger Spielcode generiert.

2. **Beitritt über einen Spielcode**  
   Spieler können einem bestehenden Quiz-Raum mit einem Spielcode und einem Benutzernamen beitreten.

3. **Mehrere Spieler gleichzeitig**  
   Mehrere Spieler können gleichzeitig an einem Quiz teilnehmen.

4. **Echtzeit-Kommunikation**  
   Die Kommunikation zwischen Server und Spielern erfolgt in Echtzeit über Socket.IO.

5. **Anzeige von Quizfragen**  
   Den Spielern werden Fragen mit mehreren Antwortmöglichkeiten angezeigt.

6. **Zeitlimit pro Frage**  
   Für jede Frage steht ein begrenztes Zeitfenster zur Verfügung. Das aktuelle Zeitlimit beträgt 15 Sekunden.

7. **Zeitabhängige Punktevergabe**  
   Eine richtige Antwort bringt Punkte. Je schneller ein Spieler richtig antwortet, desto mehr Punkte erhält er.

8. **Antwort-Feedback**  
   Nach der Beantwortung einer Frage erhält der Spieler eine Rückmeldung darüber, ob seine Antwort richtig oder falsch war.

9. **Automatischer Wechsel zur nächsten Frage**  
   Sobald alle Spieler geantwortet haben oder das Zeitlimit abgelaufen ist, wird nach einer kurzen Übergangszeit automatisch die nächste Frage gestartet.

10. **Begrenzte Anzahl an Fragen**  
    Ein Quiz besteht aus maximal 7 Fragen.

11. **Rangliste am Spielende**  
    Nach Abschluss des Quiz wird eine Rangliste mit den Spielern und ihren erreichten Punkten angezeigt.

12. **Verwaltung von Spielern**  
    Das System verhindert, dass mehrere Spieler im gleichen Raum denselben Benutzernamen verwenden.

13. **Fehlerbehandlung**  
    Das System gibt Fehlermeldungen aus, wenn beispielsweise ein ungültiger Spielcode verwendet wird oder ein Benutzername bereits vergeben ist.
