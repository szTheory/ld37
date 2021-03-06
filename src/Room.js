"use strict"

function userControlEvent(room, cb, e) {
	var user = jQuery.data(jQuery(e.target).closest("li")[0], "user")
	room[cb].call(room, room.player, user);
}

class Room {
	constructor(player, downloader) {
		this.dialog = $( "#irc-dialog").dialog({
			closeOnEscape: false,
			minWidth: 500,
			minHeight: 500,
			height: 500,
			width: 800,
			autoOpen: false,
			appendTo: $('.desktop-area'),
			beforeClose: function() {
				return false;
			},
		});

		this.player = player;

		this.users = []
		this.downloader = downloader;

		this.dialog.on('click', '.inviter',    this.inviteRandomMook.bind(this));
		this.dialog.on('click', '.downloader', this.startDownload.bind(this));

		var list = $('#user-list');
		list.on('click', '.kicker',  userControlEvent.bind(null, this, 'kick'));
		list.on('click', '.deopper', userControlEvent.bind(null, this, 'deop'));
		list.on('click', '.opper',   userControlEvent.bind(null, this, 'op'));

		this._addUser(player);
	}

	startDownload(e) {
		var file = jQuery.data(e.target.parentElement, "file");
		if(
			this.downloader.start(file, function() {
			})
		) {
			jQuery(e.target).replaceWith("DOWNLOADED!");
		}
		else {
			jQuery("<span title='ERROR!'>You can only start one dialog at a time!</span>").dialog({
				autoOpen: true,
				modal: true,
				appendTo: $('.desktop-area'),
				buttons: [
					{
						text: "sorry!",
						click: function() {
							jQuery(this).dialog("close");
						},
					}
				],
			}).dialog("moveToTop");
		}
	}

	inviteRandomMook() {
		this.inviteMookFromList([
			// Probabilties are fun, aren't they?
			UserLeech, UserLeech,
			UserCourier, UserCourier,
			UserButterfly, UserButterfly, UserButterfly,
			UserLurker, UserLurker, UserLurker, UserLurker, UserLurker, UserLurker,
			UserTroll, UserTroll2, UserTroll3,
			Kicker,
		]);
	}

	inviteMookFromList(list) {
		var user = newCall(list.randomElement());
		user.op();
		this._addUser(user);
	}

	show() {
		this.dialog.dialog("open");
	}

	_addInternal(text) {
		var area = $('#chat-area')

		var scroll = area[0].scrollHeight - area.scrollTop() - area.outerHeight() < 1;

		area.append(text);

		// Only keep last 500
		jQuery('*:lt(-500)', area).remove()
		if(scroll) {
			$('*', area).last().get(0).scrollIntoView();
		}
	}

	notifyUsers(event) {
		var args = Array.prototype.slice.call(arguments, 1);

		var users = this.users.slice()
		for(var i = 0; i < users.length; i++) {
			users[i][event].apply(users[i], args);
		}
	}

	addDownloadMessage(user, message, file) {
		if(this.addMessage(user, message)) {
			this.notifyUsers('onFilePosted', user, file);
		}
	}

	addMessage(user, message) {
		if(user.status > 0) {
			var spaces = "&nbsp;".repeat(11 - user.name.length);

			this._addInternal(
				jQuery("<div class='chat-line'></div>")
				.append("[" + spaces + user.nameString() + "] ")
				.append(
					jQuery("<span class='message' style='color: " + user.color + "'></span>")
					.append(message)
				)
			);

			this.notifyUsers('onChatMessage', user, message);
			return true;
		}
		return false;
	}

	kick(by, user) {
		if(by.canControl(user)) {
			this._addInternal("<div class='kick-line'>" +
				"User " + user.nameString() +
				" got booted from <span class='room-name'>#radwarez</span> by " + by.nameString() + "</div>"
			);
			this._removeUser(user);
			this.notifyUsers('onKick', by, user);

			if(user == this.player) {
				$('<span title="GG">' +
					'<h1>Aw, you got kicked!</h1>' +
					'You lose :(' +
					'</span>'
				).dialog({
					appendTo: $('.desktop-area'),
					beforeClose: function() {
						window.gameState.restart();
					},
					autoOpen: true,
					modal: true,
					buttons: [
						{
							text: "so sad :(",
							click: function() {
								window.gameState.restart();
							},
						}
					],
				}).dialog("moveToTop");
			}
		}
	}

	op(by, user) {
		if(by.canPromote(user)) {
			user.op();
			this._addInternal("<div class='op-line'>" +
				"User " + user.nameString() +
				" got promoted to " + user.statusName() + " status by " + by.nameString() + "</div>"
			);

			// If we're changing the local player then, well, we have to refresh the
			// whole list.
			if(user == this.player) {
				this.refreshUserList();
			}
			else {
				this.updateUserListItem(user);
			}
			this.sortUserList();

			this.notifyUsers('onOp', by, user);
		}
	}

	deop(by, user) {
		user.deop();
		this._addInternal("<div class='deop-line'>" +
			"User " + user.nameString() +
			" got demoted to " + user.statusName() + " status by " + by.nameString() + "</div>"
		);

		// If we're changing the local player then, well, we have to refresh the
		// whole list.
		if(user == this.player) {
			this.refreshUserList();
		}
		else {
			this.updateUserListItem(user);
		}
		this.sortUserList();
		this.notifyUsers('onDeop', by, user);
	}

	refreshUserList() {
		for(var i = 0; i < this.users.length;i ++ ) {
			this.updateUserListItem(this.users[i]);
		}
		this.sortUserList();
	}

	updateUserListItem(user) {
		$('#' + user.id + '-user-entry').html(
			this.getUserListElementContent(user)
		);
	}

	_removeUser(user) {
		$('#' + user.id + '-user-entry').remove();
		var i = this.users.indexOf(user);
		if(i >= 0) {
			this.users.splice(i, 1);
		}
		this.toggleInviter();
		window.gameState.removeUpdater(user);
	}

	getUserListElementContent(user) {
		return user.nameString() +
			(this.player.canControl(user) ?
				" <span class='controls'>" +
				"[<a href='#' class='kicker'>K/B</a>]" +
				"[<a href='#' class='deopper'>deop</a>]" +
				(this.player.canPromote(user) ? "[<a href='#' class='opper'>op</a>]" : "") +
				"</span>" : "");
	}

	leave(user) {
		this._removeUser(user);
		this._addInternal(
			jQuery("<div class='leave-line'></div>")
			.append(
				"User " + user.nameString() +
				" left <span class='room-name'>#radwarez</span>"
			)
		);

		this.notifyUsers('onLeave', user);
	}

	toggleInviter() {
		$('.inviter').toggle(this.users.length < 10);
	}

	_addUser(user) {
		var max_users = $('#max-users');
		this.users.push(user);
		this.toggleInviter();

		if((jQuery.data(max_users[0], 'users') || 0) < this.users.length) {
			jQuery.data(max_users[0], 'users', this.users.length);
			max_users.text(this.users.length);
		}

		window.gameState.addUpdater(user);
		var element = $("<li id='" + user.id + "-user-entry'>" +
			this.getUserListElementContent(user) + "</li>"
		);

		jQuery.data(element[0], 'user', user);


		var list = $('#user-list');
		list.append(element)
		this.sortUserList();

		this._addInternal(
			jQuery("<div class='join-line'></div>")
			.append(
				"User " + user.nameString() +
				" joined <span class='room-name'>#radwarez</span>"
			)
		);
		
		
	}

	sortUserList() {
		var li = $('#user-list li');
		li.sort(function(e1, e2) {
			var u1 = jQuery.data(e1, "user");
			var u2 = jQuery.data(e2, "user");
			return u1.compare(u2);
		}).appendTo($('#user-list'));
	}
}
