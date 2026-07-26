CREATE TABLE comments (
    post_id SERIAL,
    user_id INT NOT NULL,
    title VARCHAR(60),
    content VARCHAR(250),
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- CHECK pilnuje zakresu gwiazdek 1-5
    PRIMARY KEY (post_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

create Table Services(
id serial unique ,
title varchar(60),
content varchar(2000),
image_url VARCHAR(500)
)
