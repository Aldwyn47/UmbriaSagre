# UmbriaSagre
Very simple Web Application prototype I developed while studying at the University of Perugia. The App's Architecture features 3 tiers:

- Front-End UI consisting in a web page written in HTML, CSS and JavaScript
- Node.js web server implemented using the express module (endpoints and API are based on http methods in order to follow the REST standard as much as possible)
- PostgreSql database 

End users may register as "Organizzatore" (Event organizer) or "Utente" (Regular user). The App's purpose is to allow Event organizers to publish information related to upcoming events so that Regular users can learn about them and, if interested, subscribe. The App also provides every user with a very simple mailbox to allow direct interactions between Regular users and Event organizers.

Event organizers may:

- organize a new event
- list all events created by them
- delete an event
- broadcast a message to all users subscribed to an event

Regular users may:

- search for events (filters based on date and location are also available)
- view an event's details
- subscribe to an event (event is added to their favorites)
- cancel an existing subscription (event is removed from their favorites)
- list all favorites (filters based on date and location are also available)
- send a new private message to the organizer of an event

Both users may:

- list all messages in the mailbox
- reply to a message in the mailbox
- delete a message in the mailbox

