use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

#[derive(Clone)]
pub struct ObdRecord {
	pub path: String,
	pub name: String,
	pub category: u8,
	pub source_id: u32,
	pub thumb_w: u16,
	pub thumb_h: u16,
	pub frames: u8,
	pub sprite_count: u32,
	pub content_hash: u64,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Status {
	Idle,
	Parsing,
	Done,
}

impl Status {
	pub fn code(self) -> u8 {
		match self {
			Status::Idle => 0,
			Status::Parsing => 1,
			Status::Done => 2,
		}
	}
}

pub struct ObdStore {
	pub status: Status,
	pub error: String,
	pub job: u64,
	pub total: usize,
	pub done: usize,
	pub records: Vec<ObdRecord>,
	pub started: Option<Instant>,
	hash_count: HashMap<u64, u32>,
}

impl ObdStore {
	pub fn new() -> Self {
		ObdStore {
			status: Status::Idle,
			error: String::new(),
			job: 0,
			total: 0,
			done: 0,
			records: Vec::new(),
			started: None,
			hash_count: HashMap::new(),
		}
	}

	pub fn begin(&mut self, total: usize) -> u64 {
		self.job = self.job.wrapping_add(1);
		self.status = Status::Parsing;
		self.error = String::new();
		self.total = total;
		self.done = 0;
		self.records = Vec::with_capacity(total.min(1_000_000));
		self.hash_count = HashMap::new();
		self.started = Some(Instant::now());
		self.job
	}

	pub fn extend(&mut self, job: u64, processed: usize, recs: Vec<ObdRecord>) -> bool {
		if job != self.job {
			return false;
		}
		self.done += processed;
		for rec in recs {
			*self.hash_count.entry(rec.content_hash).or_insert(0) += 1;
			self.records.push(rec);
		}
		true
	}

	pub fn finish(&mut self, job: u64) {
		if job == self.job {
			self.status = Status::Done;
		}
	}

	pub fn is_dup(&self, hash: u64) -> bool {
		self.hash_count.get(&hash).copied().unwrap_or(0) > 1
	}

	pub fn duplicate_count(&self) -> usize {
		self.records.iter().filter(|r| self.is_dup(r.content_hash)).count()
	}

	pub fn elapsed_ms(&self) -> u64 {
		self.started.map(|s| s.elapsed().as_millis() as u64).unwrap_or(0)
	}

	pub fn clear(&mut self) {
		self.job = self.job.wrapping_add(1);
		self.status = Status::Idle;
		self.error = String::new();
		self.total = 0;
		self.done = 0;
		self.records = Vec::new();
		self.hash_count = HashMap::new();
		self.started = None;
	}
}

pub type ObdStoreState = Arc<Mutex<ObdStore>>;
