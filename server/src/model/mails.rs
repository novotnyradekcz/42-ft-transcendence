use diesel::prelude::*;
use crate::mails::{CreateMail, MailInfo};
use crate::model::database_initializer::DatabaseInitializer;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_mail)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Mail {
    id: i32,
    sender: i32,
    recipient: i32,
    title: String,
    body: String,
    images: String,
}

impl Mail {
    pub fn new(
        id: i32,
        sender: i32,
        recipient: i32,
        title: &str,
        body: &str,
        images: &str,
    ) -> Self {
        Mail {
            id,
            sender,
            recipient,
            title: title.to_owned(),
            body: body.to_owned(),
            images: images.to_owned(),
        }
    }

    pub fn get_id(&self) -> i32 {
        self.id
    }

    pub fn get_sender(&self) -> i32 {
        self.sender
    }

    pub fn get_recipient(&self) -> i32 {
        self.recipient
    }

    pub fn get_title(&self) -> &str {
        &self.title
    }

    pub fn get_body(&self) -> &str {
        &self.body
    }

    pub fn get_images(&self) -> &str {
        &self.images
    }
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_mail)]
pub struct NewMail<'a> {
    sender: i32,
    recipient: i32,
    title: &'a str,
    body: &'a str,
    images: &'a str,
}

impl<'a> NewMail<'a> {
    pub fn new(
        sender: i32,
        recipient: i32,
        title: &'a str,
        body: &'a str,
        images: &'a str,
    ) -> Self {
        NewMail {
            sender,
            recipient,
            title,
            body,
            images,
        }
    }

    pub fn get_sender(&self) -> i32 {
        self.sender
    }

    pub fn get_recipient(&self) -> i32 {
        self.recipient
    }

    pub fn get_title(&self) -> &str {
        self.title
    }

    pub fn get_body(&self) -> &str {
        self.body
    }

    pub fn get_images(&self) -> &str {
        self.images
    }
}

pub fn list_mail_in_db(
    db: &mut DatabaseInitializer,
    user_id: i32,
) -> Result<Vec<MailInfo>, diesel::result::Error> {
    use crate::model::database_initializer;
    use crate::schema::ftt_mail::dsl as mail;

    let rows = mail::ftt_mail
        .filter(mail::sender.eq(user_id).or(mail::recipient.eq(user_id)))
        .order(mail::id.asc())
        .select(Mail::as_select())
        .load::<Mail>(database_initializer::connection(db))?;

    Ok(rows.into_iter().map(MailInfo::from).collect())
}

pub fn get_mail_in_db(
    db: &mut DatabaseInitializer,
    mail_id: i32,
) -> Result<Option<crate::mails::MailInfo>, diesel::result::Error> {
    use crate::mails::MailInfo;
    use crate::model::database_initializer;
    use crate::schema::ftt_mail::dsl as mail;

    let row = mail::ftt_mail
        .filter(mail::id.eq(mail_id))
        .select(Mail::as_select())
        .first::<Mail>(database_initializer::connection(db))
        .optional()?;

    Ok(row.map(MailInfo::from))
}

pub fn create_mail_in_db(
    db: &mut DatabaseInitializer,
    new_mail: &CreateMail,
    sender_id: i32,
    recipient_id: i32,
) -> Result<crate::mails::MailInfo, diesel::result::Error> {
    use crate::model::database_initializer;
    use crate::schema::ftt_mail::dsl as mail;

    let row = diesel::insert_into(mail::ftt_mail)
        .values(&NewMail::new(
            sender_id,
            recipient_id,
            &new_mail.title.as_str(),
            &new_mail.body.as_str(),
            "",
        ))
        .returning(Mail::as_returning())
        .get_result::<Mail>(database_initializer::connection(db))?;

    Ok(row.into())
}