create table users (
	id serial primary key,
	username varchar unique not null,
	email varchar unique not null,
	password varchar not null,
	avatar_url varchar default null,
	xp integer default 0 check (xp >= 0),
	level integer default 1 check (level >= 1),
	streak integer default 0 check (streak >= 0),
	last_active date default null,
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp
);

create table courses (
	id serial primary key,
	title varchar not null,
	category varchar not null,
	proficiency_level varchar,
	description text,
	thumbnail_url varchar,
	estimated_duration integer,
	xp_reward integer default 0,
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp
);

create table lessons (
	id serial primary key,
	course_id integer not null references courses(id) on delete cascade,
	title varchar not null,
	order_index integer not null,
	videos text not null,
	overviews text,
	estimated_duration integer,
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp,
	unique(course_id, order_index)
);

create table course_enrollments (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	course_id integer not null references courses(id) on delete cascade,
	status varchar not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
	started_at timestamp,
	completed_at timestamp,
	percent_progress decimal(5,2) default 0.00 check (percent_progress >= 0 and percent_progress <= 100),
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp,
	unique(user_id, course_id)
);

create table lesson_progress (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	lesson_id integer not null references lessons(id) on delete cascade,
	status varchar not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
	started_at timestamp,
	completed_at timestamp,
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp,
	unique(user_id, lesson_id)
);

create table quiz_collections (
	id serial primary key,
	title varchar not  null,
	category varchar not null,
	icon_url varchar,
	difficulty varchar default 'beginners',
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp
);

create table quizzes (
	id serial primary key,
	collection_id integer not null references quiz_collections(id) on delete cascade,
	title varchar not null,
	thumbnail_url varchar,
	total_question integer not null,
	estimated_duration integer,
	xp_reward integer default 0,
	quiz_order integer not null,
	created_at timestamp default current_timestamp,
	updated_at timestamp default current_timestamp
);

create table quiz_questions (
	id serial primary key,
	quiz_id integer not null references quizzes(id) on delete cascade,
	question text not null,
	options jsonb,
	correct_answer text not null,
	explanation text,
	question_order integer not null,
	created_at timestamp default current_timestamp,
	unique(quiz_id, question_order)
);

create table user_answers (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	question_id integer not null references quiz_questions(id) on delete cascade,
	user_answer text not null,
	is_correct boolean not null,
	answered_at timestamp default current_timestamp
);

create table quiz_attempts (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	quiz_id integer not null references quizzes(id) on delete cascade,
	total_questions integer not null,
	total_correct integer not null,
	score integer not null,
	xp_earned integer default 0,
	completion_time integer,
	created_at timestamp default current_timestamp
);

create table badges (
	id serial primary key,
	course_id integer not null references courses(id) on delete cascade,
	name varchar not null unique,
	description text,
	icon_url varchar,
	xp_reward integer default 0,
	created_at timestamp default current_timestamp
);

create table user_badges (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	badge_id integer not null references badges(id) on delete cascade,
	earned_at timestamp default current_timestamp,
	unique(user_id, badge_id)
);

create table xp_transactions (
	id serial primary key,
	user_id integer not null references users(id) on delete cascade,
	xp_amount integer not null,
	source varchar not null,
	reference_id integer,
	created_at timestamp default current_timestamp
);

create table level_configurations (
	level integer primary key check (level >= 1),
	xp_required integer not null check (xp_required >= 0),
	badge_unlocked varchar,
	created_at timestamp default current_timestamp
);

create index idx_users_xp on users(xp desc);
create index idx_users_level on users(level desc);
create index idx_users_streak on users(streak desc);
create index idx_users_leaderboard on users(xp desc, created_at asc);
create index idx_course_enrollments_user on course_enrollments(user_id, status);
create index idx_lesson_progress_user_lesson on lesson_progress(user_id, lesson_id);
create index idx_user_answers_user_question on user_answers(user_id, question_id);
create index idx_quiz_attempts_user_quiz on quiz_attempts(user_id, quiz_id, score desc);
create index idx_xp_transactions_user_date on xp_transactions(user_id, created_at desc);

create or replace function update_user_level()
returns trigger as $$
declare
	new_level integer;
begin
	select coalesce(max(level), 1)
	into new_level
	from level_configurations
	where xp_required <= new.xp;

	if new.level != new_level then
		new.level := new_level;
	end if;
	new.updated_at := current_timestamp;
	return new;
end;
$$ language plpgsql;

create trigger trg_update_user_level
before update on users
for each row
when (old.xp is distinct from new.xp)
execute function update_user_level();

create or replace function update_user_activity()
returns trigger as $$
begin
	new.last_active := current_date;
	return new;
end;
$$ language plpgsql;

create trigger trg_update_user_activity
before update on users
for each row
execute function update_user_activity();

create or replace function update_course_progress()
returns trigger as $$
begin
	update course_enrollments ce
	set percent_progress = (
		select round(
			count(distinct lp.lesson_id)*100.0 / 
			(select count(*) from lessons l where l.course_id = ce.course_id),
			2
		)
		from lesson_progress lp
		join lessons l on lp.lesson_id = l.id
		where lp.user_id = new.user_id
			and lp.status = 'completed'
			and l.course_id = ce.course_id
	),
	status = case
		when (
			select count(distinct lp.lesson_id)
			from lesson_progress lp
			join lessons l on lp.lesson_id = l.id
			where lp.user_id = new.user_id
				and lp.status = 'completed'
				and l.course_id = ce.course_id
		) = (
			select count(*)
			from lessons
			where course_id = ce.course_id
		) then 'completed'
		when (
			select count(distinct lp.lesson_id)
			from lesson_progress lp
			join lessons l on lp.lesson_id = l.id
			where lp.user_id = new.user_id
				and lp.status = 'completed'
				and l.course_id = ce.course_id
		) > 0 then 'in_progress'
		else 'not_started'
	end,
	updated_at = current_timestamp
	where ce.user_id = new.user_id
	and ce.course_id = (
		select course_id from lessons where id = new.lesson_id
	);

	return new;
end;
$$ language plpgsql;

create trigger trg_update_course_progress
after insert or update on lesson_progress
for each row
when(new.status = 'completed')
execute function update_course_progress();

insert into level_configurations (level, xp_required) values
(1,0), (2,100), (3, 300), (4, 600), (5, 1000),
(6, 1500), (7, 2100), (8, 2800), (9, 3600), (10, 4500);